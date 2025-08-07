import React from 'react';
import { 
  Radio, 
  Input, 
  Select, 
  Checkbox, 
  Form, 
  Space, 
  Typography,
  Alert
} from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectExportDestination,
  selectExport,
  selectExportValidation,
  setDestination,
  updateEmailConfig,
  updateSftpConfig,
  updateFilesystemConfig
} from '../../../store/slices/exportSlice';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Mock SFTP connections - in real app, fetch from API
const mockSftpConnections = [
  { id: 'sftp-1', name: 'Production Server', host: 'prod.example.com' },
  { id: 'sftp-2', name: 'Backup Server', host: 'backup.example.com' },
  { id: 'sftp-3', name: 'Partner FTP', host: 'partner.example.com' }
];

const DestinationPanel: React.FC = () => {
  const dispatch = useDispatch();
  const destination = useSelector(selectExportDestination);
  const exportState = useSelector(selectExport);
  const validation = useSelector(selectExportValidation);
  
  const getFieldError = (field: string): string | undefined => {
    const error = validation.errors.find(e => e.field === field);
    return error?.message;
  };
  
  const renderEmailOptions = () => (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Form.Item 
        label="Recipients" 
        required
        validateStatus={getFieldError('recipients') ? 'error' : ''}
        help={getFieldError('recipients')}
      >
        <Input
          value={exportState.emailConfig.recipients.join(', ')}
          onChange={(e) => {
            const recipients = e.target.value
              .split(',')
              .map(r => r.trim())
              .filter(r => r.length > 0);
            dispatch(updateEmailConfig({ recipients }));
          }}
          placeholder="email1@example.com, email2@example.com"
        />
      </Form.Item>
      
      <Form.Item 
        label="CC"
        validateStatus={getFieldError('cc') ? 'error' : ''}
        help={getFieldError('cc')}
      >
        <Input
          value={exportState.emailConfig.cc.join(', ')}
          onChange={(e) => {
            const cc = e.target.value
              .split(',')
              .map(r => r.trim())
              .filter(r => r.length > 0);
            dispatch(updateEmailConfig({ cc }));
          }}
          placeholder="Optional CC recipients"
        />
      </Form.Item>
      
      <Form.Item 
        label="BCC"
        validateStatus={getFieldError('bcc') ? 'error' : ''}
        help={getFieldError('bcc')}
      >
        <Input
          value={exportState.emailConfig.bcc.join(', ')}
          onChange={(e) => {
            const bcc = e.target.value
              .split(',')
              .map(r => r.trim())
              .filter(r => r.length > 0);
            dispatch(updateEmailConfig({ bcc }));
          }}
          placeholder="Optional BCC recipients"
        />
      </Form.Item>
      
      <Form.Item 
        label="Subject" 
        required
        validateStatus={getFieldError('subject') ? 'error' : ''}
        help={getFieldError('subject')}
      >
        <Input
          value={exportState.emailConfig.subject}
          onChange={(e) => dispatch(updateEmailConfig({ subject: e.target.value }))}
          placeholder={`${exportState.reportName} - {date}`}
        />
      </Form.Item>
      
      <Form.Item label="Email Body">
        <TextArea
          value={exportState.emailConfig.body}
          onChange={(e) => dispatch(updateEmailConfig({ body: e.target.value }))}
          rows={4}
          placeholder="Please find the attached report..."
        />
      </Form.Item>
      
      <Form.Item 
        label="Attachment Name" 
        required
        validateStatus={getFieldError('attachmentName') ? 'error' : ''}
        help={getFieldError('attachmentName')}
      >
        <Input
          value={exportState.emailConfig.attachmentName}
          onChange={(e) => dispatch(updateEmailConfig({ attachmentName: e.target.value }))}
          placeholder="report_{date}"
        />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Use {'{date}'} for current date, {'{format}'} for file extension
        </Text>
      </Form.Item>
    </Space>
  );
  
  const renderSftpOptions = () => (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Alert
        message="Secure Connection"
        description="SFTP connections are pre-configured by administrators for security."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item 
        label="SFTP Connection" 
        required
        validateStatus={getFieldError('connectionId') ? 'error' : ''}
        help={getFieldError('connectionId')}
      >
        <Select
          value={exportState.sftpConfig.connectionId}
          onChange={(value) => dispatch(updateSftpConfig({ connectionId: value }))}
          placeholder="Select a pre-configured connection"
          style={{ width: '100%' }}
        >
          {mockSftpConnections.map(conn => (
            <Option key={conn.id} value={conn.id}>
              {conn.name} ({conn.host})
            </Option>
          ))}
        </Select>
      </Form.Item>
      
      <Form.Item 
        label="Remote Path" 
        required
        validateStatus={getFieldError('remotePath') ? 'error' : ''}
        help={getFieldError('remotePath')}
      >
        <Input
          value={exportState.sftpConfig.remotePath}
          onChange={(e) => dispatch(updateSftpConfig({ remotePath: e.target.value }))}
          placeholder="/exports/reports/"
        />
      </Form.Item>
      
      <Checkbox
        checked={exportState.sftpConfig.overwrite}
        onChange={(e) => dispatch(updateSftpConfig({ overwrite: e.target.checked }))}
      >
        Overwrite if file exists
      </Checkbox>
    </Space>
  );
  
  const renderFilesystemOptions = () => (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Alert
        message="Server-Side Execution"
        description="File system exports run on the server with restricted access to approved directories."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item 
        label="File Path" 
        required
        validateStatus={getFieldError('path') ? 'error' : ''}
        help={getFieldError('path')}
      >
        <Input
          value={exportState.filesystemConfig.path}
          onChange={(e) => dispatch(updateFilesystemConfig({ path: e.target.value }))}
          placeholder="/exports/reports/"
        />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Path must be within approved export directories
        </Text>
      </Form.Item>
      
      <Checkbox
        checked={exportState.filesystemConfig.overwrite}
        onChange={(e) => dispatch(updateFilesystemConfig({ overwrite: e.target.checked }))}
      >
        Overwrite if file exists
      </Checkbox>
      
      <Checkbox
        checked={exportState.filesystemConfig.createPath}
        onChange={(e) => dispatch(updateFilesystemConfig({ createPath: e.target.checked }))}
      >
        Create directories if they don't exist
      </Checkbox>
    </Space>
  );
  
  return (
    <div>
      <Form.Item label="Delivery Method">
        <Radio.Group 
          value={destination} 
          onChange={(e) => dispatch(setDestination(e.target.value))}
        >
          <Space direction="vertical">
            <Radio value="download">
              <Space>
                <Text strong>Direct Download</Text>
                <Text type="secondary">- Download file to your computer</Text>
              </Space>
            </Radio>
            <Radio value="email">
              <Space>
                <Text strong>Email</Text>
                <Text type="secondary">- Send as email attachment</Text>
              </Space>
            </Radio>
            <Radio value="filesystem">
              <Space>
                <Text strong>File System</Text>
                <Text type="secondary">- Save to server directory</Text>
              </Space>
            </Radio>
            <Radio value="sftp">
              <Space>
                <Text strong>SFTP</Text>
                <Text type="secondary">- Transfer to remote server</Text>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>
      </Form.Item>
      
      {destination === 'email' && renderEmailOptions()}
      {destination === 'sftp' && renderSftpOptions()}
      {destination === 'filesystem' && renderFilesystemOptions()}
      
      {destination === 'download' && (
        <Alert
          message="Direct Download"
          description="The file will be downloaded to your default downloads folder when the export completes."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default DestinationPanel;