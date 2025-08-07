import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Radio, 
  Checkbox, 
  Select, 
  Input, 
  Button, 
  Space, 
  Divider,
  Alert,
  Tabs,
  InputNumber,
  Switch,
  DatePicker,
  TimePicker
} from 'antd';
import {
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  MailOutlined,
  FolderOutlined,
  ScheduleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import type { ReportDefinition } from '../../types';
import type { Dayjs } from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

interface ExportDialogProps {
  visible: boolean;
  onClose: () => void;
  report: ReportDefinition | null;
  onExport: (config: ExportConfig) => void;
}

export interface ExportConfig {
  format: 'csv' | 'excel' | 'pdf';
  formatOptions: {
    includeHeaders: boolean;
    includeFilters: boolean;
    includeTimestamp: boolean;
    includeMetadata: boolean;
    // CSV specific
    delimiter?: ',' | ';' | '\t' | '|';
    encoding?: 'utf-8' | 'utf-16' | 'ascii';
    // Excel specific
    sheetName?: string;
    autoWidth?: boolean;
    freezePanes?: boolean;
    includeFormulas?: boolean;
    // PDF specific
    orientation?: 'portrait' | 'landscape';
    pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
    margins?: { top: number; right: number; bottom: number; left: number };
    includeCharts?: boolean;
    headerFooter?: boolean;
  };
  distribution: {
    method: 'download' | 'email' | 'filesystem' | 'sftp';
    email?: {
      recipients: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      attachmentName: string;
    };
    filesystem?: {
      path: string;
      overwrite: boolean;
      createPath: boolean;
    };
    sftp?: {
      host: string;
      port: number;
      username: string;
      password?: string;
      privateKey?: string;
      remotePath: string;
    };
  };
  scheduling?: {
    enabled: boolean;
    frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
    startDate: Dayjs;
    endDate?: Dayjs;
    time: Dayjs;
    daysOfWeek?: number[]; // 0-6, Sunday-Saturday
    dayOfMonth?: number; // 1-31
    cronExpression?: string;
    timezone: string;
  };
  bursting?: {
    enabled: boolean;
    splitBy: string; // field to split by
    namingPattern: string; // e.g., "Report_{fieldValue}_{date}"
    separateFiles: boolean;
  };
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  visible,
  onClose,
  report,
  onExport
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('format');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'pdf'>('excel');
  const [distributionMethod, setDistributionMethod] = useState<string>('download');
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [burstingEnabled, setBurstingEnabled] = useState(false);

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const config: ExportConfig = {
        format: selectedFormat,
        formatOptions: {
          includeHeaders: values.includeHeaders ?? true,
          includeFilters: values.includeFilters ?? false,
          includeTimestamp: values.includeTimestamp ?? false,
          includeMetadata: values.includeMetadata ?? false,
          ...(selectedFormat === 'csv' && {
            delimiter: values.delimiter,
            encoding: values.encoding
          }),
          ...(selectedFormat === 'excel' && {
            sheetName: values.sheetName,
            autoWidth: values.autoWidth,
            freezePanes: values.freezePanes,
            includeFormulas: values.includeFormulas
          }),
          ...(selectedFormat === 'pdf' && {
            orientation: values.orientation,
            pageSize: values.pageSize,
            margins: values.margins,
            includeCharts: values.includeCharts,
            headerFooter: values.headerFooter
          })
        },
        distribution: {
          method: distributionMethod as any,
          ...(distributionMethod === 'email' && {
            email: {
              recipients: values.recipients?.split(',').map((r: string) => r.trim()),
              cc: values.cc?.split(',').map((r: string) => r.trim()),
              bcc: values.bcc?.split(',').map((r: string) => r.trim()),
              subject: values.subject,
              body: values.body,
              attachmentName: values.attachmentName
            }
          }),
          ...(distributionMethod === 'filesystem' && {
            filesystem: {
              path: values.path,
              overwrite: values.overwrite,
              createPath: values.createPath
            }
          })
        },
        ...(schedulingEnabled && {
          scheduling: {
            enabled: true,
            frequency: values.frequency,
            startDate: values.startDate,
            endDate: values.endDate,
            time: values.time,
            daysOfWeek: values.daysOfWeek,
            dayOfMonth: values.dayOfMonth,
            cronExpression: values.cronExpression,
            timezone: values.timezone || 'UTC'
          }
        }),
        ...(burstingEnabled && {
          bursting: {
            enabled: true,
            splitBy: values.splitBy,
            namingPattern: values.namingPattern,
            separateFiles: values.separateFiles
          }
        })
      };
      
      onExport(config);
      onClose();
    });
  };

  const renderFormatOptions = () => {
    const commonOptions = (
      <>
        <Form.Item name="includeHeaders" valuePropName="checked">
          <Checkbox>Include column headers</Checkbox>
        </Form.Item>
        <Form.Item name="includeFilters" valuePropName="checked">
          <Checkbox>Include applied filters</Checkbox>
        </Form.Item>
        <Form.Item name="includeTimestamp" valuePropName="checked">
          <Checkbox>Include export timestamp</Checkbox>
        </Form.Item>
        <Form.Item name="includeMetadata" valuePropName="checked">
          <Checkbox>Include report metadata</Checkbox>
        </Form.Item>
      </>
    );

    if (selectedFormat === 'csv') {
      return (
        <>
          {commonOptions}
          <Divider />
          <Form.Item name="delimiter" label="Delimiter" initialValue=",">
            <Radio.Group>
              <Radio value=",">Comma (,)</Radio>
              <Radio value=";">Semicolon (;)</Radio>
              <Radio value="\t">Tab</Radio>
              <Radio value="|">Pipe (|)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="encoding" label="Encoding" initialValue="utf-8">
            <Select>
              <Option value="utf-8">UTF-8</Option>
              <Option value="utf-16">UTF-16</Option>
              <Option value="ascii">ASCII</Option>
            </Select>
          </Form.Item>
        </>
      );
    }

    if (selectedFormat === 'excel') {
      return (
        <>
          {commonOptions}
          <Divider />
          <Form.Item name="sheetName" label="Sheet Name" initialValue="Report">
            <Input placeholder="Sheet name" />
          </Form.Item>
          <Form.Item name="autoWidth" valuePropName="checked">
            <Checkbox>Auto-adjust column width</Checkbox>
          </Form.Item>
          <Form.Item name="freezePanes" valuePropName="checked">
            <Checkbox>Freeze header row</Checkbox>
          </Form.Item>
          <Form.Item name="includeFormulas" valuePropName="checked">
            <Checkbox>Include formulas</Checkbox>
          </Form.Item>
        </>
      );
    }

    if (selectedFormat === 'pdf') {
      return (
        <>
          {commonOptions}
          <Divider />
          <Form.Item name="orientation" label="Orientation" initialValue="portrait">
            <Radio.Group>
              <Radio value="portrait">Portrait</Radio>
              <Radio value="landscape">Landscape</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="pageSize" label="Page Size" initialValue="A4">
            <Select>
              <Option value="A4">A4</Option>
              <Option value="A3">A3</Option>
              <Option value="Letter">Letter</Option>
              <Option value="Legal">Legal</Option>
            </Select>
          </Form.Item>
          <Form.Item name="includeCharts" valuePropName="checked">
            <Checkbox>Include charts and visualizations</Checkbox>
          </Form.Item>
          <Form.Item name="headerFooter" valuePropName="checked">
            <Checkbox>Include header and footer</Checkbox>
          </Form.Item>
        </>
      );
    }

    return null;
  };

  return (
    <Modal
      title="Export Report"
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      width={720}
      okText="Export"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={<><SettingOutlined /> Format</>} key="format">
            <Form.Item label="Export Format">
              <Radio.Group value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)}>
                <Radio.Button value="csv">
                  <FileTextOutlined /> CSV
                </Radio.Button>
                <Radio.Button value="excel">
                  <FileExcelOutlined /> Excel
                </Radio.Button>
                <Radio.Button value="pdf">
                  <FilePdfOutlined /> PDF
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Divider />
            {renderFormatOptions()}
          </TabPane>

          <TabPane tab={<><MailOutlined /> Distribution</>} key="distribution">
            <Form.Item label="Delivery Method">
              <Radio.Group value={distributionMethod} onChange={e => setDistributionMethod(e.target.value)}>
                <Radio value="download">Direct Download</Radio>
                <Radio value="email">Email</Radio>
                <Radio value="filesystem">File System</Radio>
                <Radio value="sftp">SFTP</Radio>
              </Radio.Group>
            </Form.Item>
            
            {distributionMethod === 'email' && (
              <>
                <Form.Item name="recipients" label="Recipients" rules={[{ required: true }]}>
                  <Input placeholder="email1@example.com, email2@example.com" />
                </Form.Item>
                <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
                  <Input placeholder="Report: {reportName} - {date}" />
                </Form.Item>
                <Form.Item name="body" label="Email Body">
                  <Input.TextArea rows={4} placeholder="Please find the attached report..." />
                </Form.Item>
                <Form.Item name="attachmentName" label="Attachment Name">
                  <Input placeholder="report_{date}.{format}" />
                </Form.Item>
              </>
            )}

            {distributionMethod === 'filesystem' && (
              <>
                <Form.Item name="path" label="File Path" rules={[{ required: true }]}>
                  <Input placeholder="/exports/reports/" />
                </Form.Item>
                <Form.Item name="overwrite" valuePropName="checked">
                  <Checkbox>Overwrite if exists</Checkbox>
                </Form.Item>
                <Form.Item name="createPath" valuePropName="checked">
                  <Checkbox>Create path if not exists</Checkbox>
                </Form.Item>
              </>
            )}
          </TabPane>

          <TabPane tab={<><ScheduleOutlined /> Schedule</>} key="schedule">
            <Form.Item label="Enable Scheduling">
              <Switch checked={schedulingEnabled} onChange={setSchedulingEnabled} />
            </Form.Item>
            
            {schedulingEnabled && (
              <>
                <Form.Item name="frequency" label="Frequency" initialValue="daily">
                  <Select>
                    <Option value="once">Once</Option>
                    <Option value="daily">Daily</Option>
                    <Option value="weekly">Weekly</Option>
                    <Option value="monthly">Monthly</Option>
                    <Option value="custom">Custom (Cron)</Option>
                  </Select>
                </Form.Item>
                
                <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                
                <Form.Item name="time" label="Time" rules={[{ required: true }]}>
                  <TimePicker style={{ width: '100%' }} format="HH:mm" />
                </Form.Item>
                
                <Form.Item name="timezone" label="Timezone" initialValue="UTC">
                  <Select>
                    <Option value="UTC">UTC</Option>
                    <Option value="America/New_York">Eastern Time</Option>
                    <Option value="America/Chicago">Central Time</Option>
                    <Option value="America/Los_Angeles">Pacific Time</Option>
                  </Select>
                </Form.Item>
              </>
            )}
          </TabPane>

          <TabPane tab={<><FolderOutlined /> Bursting</>} key="bursting">
            <Alert
              message="Report Bursting"
              description="Split the report into multiple files based on a field value (e.g., department, region)"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form.Item label="Enable Bursting">
              <Switch checked={burstingEnabled} onChange={setBurstingEnabled} />
            </Form.Item>
            
            {burstingEnabled && (
              <>
                <Form.Item name="splitBy" label="Split By Field" rules={[{ required: true }]}>
                  <Select placeholder="Select field to split by">
                    {/* This would be populated with actual fields from the report */}
                    <Option value="department">Department</Option>
                    <Option value="region">Region</Option>
                    <Option value="manager">Manager</Option>
                  </Select>
                </Form.Item>
                
                <Form.Item name="namingPattern" label="File Naming Pattern" initialValue="Report_{fieldValue}_{date}">
                  <Input placeholder="Report_{fieldValue}_{date}" />
                </Form.Item>
                
                <Form.Item name="separateFiles" valuePropName="checked">
                  <Checkbox>Generate separate files for each value</Checkbox>
                </Form.Item>
              </>
            )}
          </TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
};

export default ExportDialog;