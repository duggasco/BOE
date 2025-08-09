import React, { useState } from 'react';
import {
  Form,
  Input,
  Select,
  Checkbox,
  InputNumber,
  Space,
  Button,
  Tag,
  Typography,
  Alert,
  Divider,
  message
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { emailTestService } from '../../../services/api/scheduleService';
import type { EmailDistributionConfig } from '../../../types/schedule';

const { TextArea } = Input;
const { Text } = Typography;

interface EmailConfigFormProps {
  form: any;
  initialValue?: Partial<EmailDistributionConfig>;
}

const EmailConfigForm: React.FC<EmailConfigFormProps> = ({ form, initialValue }) => {
  const [testingConnection, setTestingConnection] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(initialValue?.recipients || []);
  const [ccRecipients, setCcRecipients] = useState<string[]>(initialValue?.cc || []);
  const [bccRecipients, setBccRecipients] = useState<string[]>(initialValue?.bcc || []);
  const [emailInput, setEmailInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Add recipient
  const addRecipient = (type: 'to' | 'cc' | 'bcc') => {
    const input = type === 'to' ? emailInput : type === 'cc' ? ccInput : bccInput;
    const setList = type === 'to' ? setRecipients : type === 'cc' ? setCcRecipients : setBccRecipients;
    const setInput = type === 'to' ? setEmailInput : type === 'cc' ? setCcInput : setBccInput;
    const currentList = type === 'to' ? recipients : type === 'cc' ? ccRecipients : bccRecipients;

    if (input && validateEmail(input)) {
      if (!currentList.includes(input)) {
        const newList = [...currentList, input];
        setList(newList);
        
        // Update form value
        if (type === 'to') {
          form.setFieldsValue({ 
            distribution_config: { 
              ...form.getFieldValue('distribution_config'),
              email: { 
                ...form.getFieldValue(['distribution_config', 'email']),
                recipients: newList 
              }
            }
          });
        } else if (type === 'cc') {
          form.setFieldsValue({ 
            distribution_config: { 
              ...form.getFieldValue('distribution_config'),
              email: { 
                ...form.getFieldValue(['distribution_config', 'email']),
                cc: newList 
              }
            }
          });
        } else {
          form.setFieldsValue({ 
            distribution_config: { 
              ...form.getFieldValue('distribution_config'),
              email: { 
                ...form.getFieldValue(['distribution_config', 'email']),
                bcc: newList 
              }
            }
          });
        }
        
        setInput('');
      } else {
        message.warning('Email already in list');
      }
    } else {
      message.error('Please enter a valid email address');
    }
  };

  // Remove recipient
  const removeRecipient = (email: string, type: 'to' | 'cc' | 'bcc') => {
    const list = type === 'to' ? recipients : type === 'cc' ? ccRecipients : bccRecipients;
    const setList = type === 'to' ? setRecipients : type === 'cc' ? setCcRecipients : setBccRecipients;
    
    const newList = list.filter(r => r !== email);
    setList(newList);
    
    // Update form value
    if (type === 'to') {
      form.setFieldsValue({ 
        distribution_config: { 
          ...form.getFieldValue('distribution_config'),
          email: { 
            ...form.getFieldValue(['distribution_config', 'email']),
            recipients: newList 
          }
        }
      });
    } else if (type === 'cc') {
      form.setFieldsValue({ 
        distribution_config: { 
          ...form.getFieldValue('distribution_config'),
          email: { 
            ...form.getFieldValue(['distribution_config', 'email']),
            cc: newList 
          }
        }
      });
    } else {
      form.setFieldsValue({ 
        distribution_config: { 
          ...form.getFieldValue('distribution_config'),
          email: { 
            ...form.getFieldValue(['distribution_config', 'email']),
            bcc: newList 
          }
        }
      });
    }
  };

  // Test email connection
  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await emailTestService.testConnection();
      if (result.success) {
        message.success(`SMTP connection successful! Server: ${result.server}:${result.port}`);
      } else {
        message.error(result.error || 'SMTP connection failed');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };

  // Send test email
  const sendTestEmail = async () => {
    if (recipients.length === 0) {
      message.warning('Please add at least one recipient');
      return;
    }

    try {
      const result = await emailTestService.sendTestEmail({
        recipient: recipients[0],
        subject: form.getFieldValue(['distribution_config', 'email', 'subject']) || 'Test Email',
        message: 'This is a test email from BOE Scheduling System'
      });
      
      if (result.success) {
        message.success('Test email sent successfully!');
      } else {
        message.error(result.error || 'Failed to send test email');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to send test email');
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        message="Email Distribution Settings"
        description="Configure email recipients and options for report delivery"
        type="info"
        showIcon
      />

      {/* Recipients */}
      <div>
        <Text strong>Recipients *</Text>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input
            placeholder="Enter email address"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onPressEnter={() => addRecipient('to')}
          />
          <Button onClick={() => addRecipient('to')} icon={<PlusOutlined />}>
            Add
          </Button>
        </Space.Compact>
        <div style={{ marginTop: 8 }}>
          {recipients.map(email => (
            <Tag
              key={email}
              closable
              onClose={() => removeRecipient(email, 'to')}
              style={{ marginBottom: 4 }}
            >
              {email}
            </Tag>
          ))}
        </div>
        {recipients.length === 0 && (
          <Text type="danger" style={{ fontSize: 12 }}>
            At least one recipient is required
          </Text>
        )}
      </div>

      {/* CC Recipients */}
      <div>
        <Text>CC Recipients</Text>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input
            placeholder="Enter CC email address"
            value={ccInput}
            onChange={(e) => setCcInput(e.target.value)}
            onPressEnter={() => addRecipient('cc')}
          />
          <Button onClick={() => addRecipient('cc')} icon={<PlusOutlined />}>
            Add
          </Button>
        </Space.Compact>
        <div style={{ marginTop: 8 }}>
          {ccRecipients.map(email => (
            <Tag
              key={email}
              closable
              onClose={() => removeRecipient(email, 'cc')}
              style={{ marginBottom: 4 }}
            >
              {email}
            </Tag>
          ))}
        </div>
      </div>

      {/* BCC Recipients */}
      <div>
        <Text>BCC Recipients</Text>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input
            placeholder="Enter BCC email address"
            value={bccInput}
            onChange={(e) => setBccInput(e.target.value)}
            onPressEnter={() => addRecipient('bcc')}
          />
          <Button onClick={() => addRecipient('bcc')} icon={<PlusOutlined />}>
            Add
          </Button>
        </Space.Compact>
        <div style={{ marginTop: 8 }}>
          {bccRecipients.map(email => (
            <Tag
              key={email}
              closable
              onClose={() => removeRecipient(email, 'bcc')}
              style={{ marginBottom: 4 }}
            >
              {email}
            </Tag>
          ))}
        </div>
      </div>

      <Divider />

      {/* Email Subject */}
      <Form.Item
        name={['distribution_config', 'email', 'subject']}
        label="Email Subject"
        initialValue="Scheduled Report: {report_name}"
        extra="You can use variables: {report_name}, {date}, {time}"
      >
        <Input placeholder="Enter email subject" />
      </Form.Item>

      {/* Custom Message */}
      <Form.Item
        name={['distribution_config', 'email', 'custom_message']}
        label="Custom Message"
        extra="This message will be included in the email body"
      >
        <TextArea
          placeholder="Enter a custom message for recipients"
          rows={4}
        />
      </Form.Item>

      {/* Attachment Settings */}
      <Form.Item
        name={['distribution_config', 'email', 'include_attachment']}
        valuePropName="checked"
        initialValue={true}
      >
        <Checkbox>Include report as attachment</Checkbox>
      </Form.Item>

      <Form.Item
        name={['distribution_config', 'email', 'max_attachment_size']}
        label="Max Attachment Size (MB)"
        initialValue={10}
        extra="Files larger than this will be sent as download links"
      >
        <InputNumber
          min={1}
          max={50}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Divider />

      {/* Test Buttons */}
      <Space>
        <Button
          onClick={testConnection}
          loading={testingConnection}
          icon={<InfoCircleOutlined />}
        >
          Test SMTP Connection
        </Button>
        <Button
          onClick={sendTestEmail}
          icon={<SendOutlined />}
          disabled={recipients.length === 0}
        >
          Send Test Email
        </Button>
      </Space>
    </Space>
  );
};

export default EmailConfigForm;