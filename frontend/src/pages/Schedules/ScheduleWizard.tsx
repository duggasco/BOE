import React, { useState, useEffect } from 'react';
import {
  Steps,
  Card,
  Button,
  Form,
  Input,
  Select,
  Radio,
  TimePicker,
  DatePicker,
  Checkbox,
  InputNumber,
  Space,
  Typography,
  Alert,
  message,
  Divider,
  Row,
  Col,
  Tag,
  Spin
} from 'antd';
import {
  ClockCircleOutlined,
  FileTextOutlined,
  SendOutlined,
  CheckCircleOutlined,
  MailOutlined,
  CloudUploadOutlined,
  FolderOutlined,
  GlobalOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { scheduleService } from '../../services/api/scheduleService';
import { reportService } from '../../services/api/reportService';
import type { 
  Schedule, 
  ScheduleCreate, 
  ScheduleConfig,
  DistributionConfig,
  ExportConfig
} from '../../types/schedule';
import EmailConfigForm from './components/EmailConfigForm';
import DistributionSelector from './components/DistributionSelector';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface WizardFormData extends ScheduleCreate {
  reportName?: string;
}

const ScheduleWizard: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<WizardFormData>();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<WizardFormData>>({
    schedule_config: {
      frequency: 'daily',
      timezone: dayjs.tz.guess()
    },
    distribution_config: {},
    export_config: {
      format: 'excel',
      include_headers: true,
      compress: false
    },
    is_active: true
  });
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextRunPreview, setNextRunPreview] = useState<string>('');

  // Fetch available reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await reportService.getReports();
        setReports(response.reports);
      } catch (error: any) {
        message.error('Failed to fetch reports');
      }
    };
    fetchReports();
  }, []);

  // Calculate next run preview
  const calculateNextRun = async (config: Partial<ScheduleConfig>) => {
    try {
      const result = await scheduleService.testConfiguration({
        schedule_config: { ...formData.schedule_config, ...config } as ScheduleConfig
      });
      if (result.next_run) {
        setNextRunPreview(dayjs(result.next_run).format('MMMM D, YYYY h:mm A'));
      }
    } catch (error) {
      // Ignore errors in preview calculation
    }
  };

  // Handle step navigation
  const handleNext = async () => {
    try {
      const values = await form.validateFields();
      setFormData({ ...formData, ...values });
      setCurrentStep(currentStep + 1);
    } catch (error) {
      message.error('Please fill in all required fields');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  // Handle final submission
  const handleFinish = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const finalData = { ...formData, ...values };
      
      // Prepare the schedule data
      const scheduleData: ScheduleCreate = {
        name: finalData.name!,
        description: finalData.description,
        report_id: finalData.report_id!,
        schedule_config: finalData.schedule_config!,
        distribution_config: finalData.distribution_config!,
        export_config: finalData.export_config!,
        is_active: finalData.is_active
      };

      const created = await scheduleService.createSchedule(scheduleData);
      message.success('Schedule created successfully!');
      navigate('/schedules');
    } catch (error: any) {
      message.error(error.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Information
        return (
          <Form.Item>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Form.Item
                  name="name"
                  label="Schedule Name"
                  rules={[{ required: true, message: 'Please enter a schedule name' }]}
                >
                  <Input 
                    placeholder="e.g., Daily Sales Report"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="Description"
                >
                  <TextArea 
                    placeholder="Describe the purpose of this schedule"
                    rows={3}
                  />
                </Form.Item>

                <Form.Item
                  name="report_id"
                  label="Select Report"
                  rules={[{ required: true, message: 'Please select a report' }]}
                >
                  <Select
                    placeholder="Choose a report to schedule"
                    size="large"
                    showSearch
                    optionFilterProp="children"
                  >
                    {reports.map(report => (
                      <Option key={report.id} value={report.id}>
                        {report.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="is_active"
                  valuePropName="checked"
                  initialValue={true}
                >
                  <Checkbox>Activate schedule immediately</Checkbox>
                </Form.Item>
              </div>
            </Space>
          </Form.Item>
        );

      case 1: // Schedule Configuration
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Form.Item
              name={['schedule_config', 'frequency']}
              label="Frequency"
              initialValue="daily"
            >
              <Radio.Group 
                size="large"
                onChange={(e) => calculateNextRun({ frequency: e.target.value })}
              >
                <Space direction="vertical">
                  <Radio value="once">One Time</Radio>
                  <Radio value="hourly">Hourly</Radio>
                  <Radio value="daily">Daily</Radio>
                  <Radio value="weekly">Weekly</Radio>
                  <Radio value="monthly">Monthly</Radio>
                  <Radio value="custom">Custom (Cron Expression)</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {form.getFieldValue(['schedule_config', 'frequency']) === 'daily' && (
              <Form.Item
                name={['schedule_config', 'time']}
                label="Time"
                rules={[{ required: true, message: 'Please select a time' }]}
              >
                <TimePicker 
                  format="HH:mm"
                  size="large"
                  style={{ width: '100%' }}
                  onChange={(time) => {
                    if (time) {
                      calculateNextRun({ time: time.format('HH:mm') });
                    }
                  }}
                />
              </Form.Item>
            )}

            {form.getFieldValue(['schedule_config', 'frequency']) === 'weekly' && (
              <>
                <Form.Item
                  name={['schedule_config', 'day_of_week']}
                  label="Day of Week"
                  rules={[{ required: true, message: 'Please select a day' }]}
                >
                  <Select size="large">
                    <Option value={0}>Sunday</Option>
                    <Option value={1}>Monday</Option>
                    <Option value={2}>Tuesday</Option>
                    <Option value={3}>Wednesday</Option>
                    <Option value={4}>Thursday</Option>
                    <Option value={5}>Friday</Option>
                    <Option value={6}>Saturday</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  name={['schedule_config', 'time']}
                  label="Time"
                  rules={[{ required: true, message: 'Please select a time' }]}
                >
                  <TimePicker 
                    format="HH:mm"
                    size="large"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </>
            )}

            {form.getFieldValue(['schedule_config', 'frequency']) === 'custom' && (
              <Form.Item
                name={['schedule_config', 'cron_expression']}
                label="Cron Expression"
                rules={[{ required: true, message: 'Please enter a cron expression' }]}
                extra="e.g., 0 9 * * MON-FRI (9 AM on weekdays)"
              >
                <Input 
                  placeholder="* * * * *"
                  size="large"
                />
              </Form.Item>
            )}

            <Form.Item
              name={['schedule_config', 'timezone']}
              label="Timezone"
              initialValue={dayjs.tz.guess()}
            >
              <Select 
                size="large"
                showSearch
                optionFilterProp="children"
              >
                {dayjs.tz.names().map(tz => (
                  <Option key={tz} value={tz}>{tz}</Option>
                ))}
              </Select>
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name={['schedule_config', 'start_date']}
                  label="Start Date (Optional)"
                >
                  <DatePicker 
                    size="large"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name={['schedule_config', 'end_date']}
                  label="End Date (Optional)"
                >
                  <DatePicker 
                    size="large"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {nextRunPreview && (
              <Alert
                message="Next Run"
                description={nextRunPreview}
                type="info"
                showIcon
                icon={<ClockCircleOutlined />}
              />
            )}
          </Space>
        );

      case 2: // Export Configuration
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Form.Item
              name={['export_config', 'format']}
              label="Export Format"
              initialValue="excel"
            >
              <Radio.Group size="large">
                <Space direction="vertical">
                  <Radio value="csv">CSV - Comma Separated Values</Radio>
                  <Radio value="excel">Excel - XLSX Format</Radio>
                  <Radio value="pdf">PDF - Portable Document Format</Radio>
                  <Radio value="json">JSON - JavaScript Object Notation</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name={['export_config', 'include_headers']}
              valuePropName="checked"
              initialValue={true}
            >
              <Checkbox>Include column headers</Checkbox>
            </Form.Item>

            <Form.Item
              name={['export_config', 'compress']}
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>Compress file (ZIP)</Checkbox>
            </Form.Item>

            {form.getFieldValue(['export_config', 'format']) === 'pdf' && (
              <Form.Item
                name={['export_config', 'password_protect']}
                valuePropName="checked"
              >
                <Checkbox>Password protect PDF</Checkbox>
              </Form.Item>
            )}

            {form.getFieldValue(['export_config', 'password_protect']) && (
              <Form.Item
                name={['export_config', 'password']}
                label="PDF Password"
                rules={[{ required: true, message: 'Please enter a password' }]}
              >
                <Input.Password size="large" />
              </Form.Item>
            )}
          </Space>
        );

      case 3: // Distribution Configuration
        return (
          <DistributionSelector
            form={form}
            initialValue={formData.distribution_config}
          />
        );

      case 4: // Review & Confirm
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="Review Your Schedule"
              description="Please review the schedule configuration below before creating."
              type="info"
              showIcon
            />

            <Card title="Basic Information" size="small">
              <Paragraph>
                <Text strong>Name:</Text> {formData.name}
              </Paragraph>
              {formData.description && (
                <Paragraph>
                  <Text strong>Description:</Text> {formData.description}
                </Paragraph>
              )}
              <Paragraph>
                <Text strong>Report:</Text> {reports.find(r => r.id === formData.report_id)?.name}
              </Paragraph>
              <Paragraph>
                <Text strong>Status:</Text> {formData.is_active ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>}
              </Paragraph>
            </Card>

            <Card title="Schedule" size="small">
              <Paragraph>
                <Text strong>Frequency:</Text> {formData.schedule_config?.frequency}
              </Paragraph>
              <Paragraph>
                <Text strong>Timezone:</Text> {formData.schedule_config?.timezone}
              </Paragraph>
              {nextRunPreview && (
                <Paragraph>
                  <Text strong>Next Run:</Text> {nextRunPreview}
                </Paragraph>
              )}
            </Card>

            <Card title="Export" size="small">
              <Paragraph>
                <Text strong>Format:</Text> {formData.export_config?.format?.toUpperCase()}
              </Paragraph>
              <Paragraph>
                <Text strong>Options:</Text>
                {formData.export_config?.include_headers && <Tag>Headers</Tag>}
                {formData.export_config?.compress && <Tag>Compressed</Tag>}
                {formData.export_config?.password_protect && <Tag>Password Protected</Tag>}
              </Paragraph>
            </Card>

            <Card title="Distribution" size="small">
              {formData.distribution_config?.email && (
                <Paragraph>
                  <MailOutlined /> Email to {formData.distribution_config.email.recipients.length} recipients
                </Paragraph>
              )}
              {formData.distribution_config?.local && (
                <Paragraph>
                  <FolderOutlined /> Save to local storage
                </Paragraph>
              )}
              {formData.distribution_config?.cloud && (
                <Paragraph>
                  <CloudUploadOutlined /> Upload to {formData.distribution_config.cloud.provider}
                </Paragraph>
              )}
            </Card>
          </Space>
        );

      default:
        return null;
    }
  };

  const steps = [
    {
      title: 'Basic Info',
      icon: <FileTextOutlined />
    },
    {
      title: 'Schedule',
      icon: <ClockCircleOutlined />
    },
    {
      title: 'Export',
      icon: <FileTextOutlined />
    },
    {
      title: 'Distribution',
      icon: <SendOutlined />
    },
    {
      title: 'Review',
      icon: <CheckCircleOutlined />
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>Create Schedule</Title>
        
        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />
        
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            initialValues={formData}
          >
            {renderStepContent()}
          </Form>
        </Spin>

        <Divider />

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrevious}>
                Previous
              </Button>
            )}
          </Space>
          
          <Space>
            <Button onClick={() => navigate('/schedules')}>
              Cancel
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button type="primary" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button 
                type="primary" 
                onClick={handleFinish}
                loading={loading}
              >
                Create Schedule
              </Button>
            )}
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default ScheduleWizard;