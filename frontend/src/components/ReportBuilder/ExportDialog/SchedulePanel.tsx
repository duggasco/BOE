import React, { useCallback } from 'react';
import { Form, Switch, Select, DatePicker, TimePicker, Radio, InputNumber, Space, Typography, Alert } from 'antd';
import { InfoCircleOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { selectExportSchedule, updateSchedule, toggleSchedule } from '../../../store/slices/exportSlice';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const { Option } = Select;
const { Title, Text } = Typography;

const SchedulePanel: React.FC = () => {
  const dispatch = useDispatch();
  const schedule = useSelector(selectExportSchedule);
  
  const handleScheduleToggle = useCallback((checked: boolean) => {
    dispatch(toggleSchedule());
    if (checked && !schedule.startDate) {
      // Set default start date to tomorrow
      dispatch(updateSchedule({
        startDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        startTime: '09:00'
      }));
    }
  }, [dispatch, schedule.startDate]);
  
  const handleScheduleTypeChange = useCallback((type: string) => {
    dispatch(updateSchedule({ type: type as any }));
    
    // Set default values based on type
    if (type === 'weekly' && !schedule.dayOfWeek) {
      dispatch(updateSchedule({ dayOfWeek: 1 })); // Monday
    } else if (type === 'monthly' && !schedule.dayOfMonth) {
      dispatch(updateSchedule({ dayOfMonth: 1 })); // 1st of month
    }
  }, [dispatch, schedule.dayOfWeek, schedule.dayOfMonth]);
  
  const handleStartDateChange = useCallback((date: any) => {
    if (date) {
      dispatch(updateSchedule({ startDate: date.format('YYYY-MM-DD') }));
    }
  }, [dispatch]);
  
  const handleEndDateChange = useCallback((date: any) => {
    if (date) {
      dispatch(updateSchedule({ endDate: date.format('YYYY-MM-DD') }));
    } else {
      dispatch(updateSchedule({ endDate: undefined }));
    }
  }, [dispatch]);
  
  const handleStartTimeChange = useCallback((time: any) => {
    if (time) {
      dispatch(updateSchedule({ startTime: time.format('HH:mm') }));
    }
  }, [dispatch]);
  
  const handleTimezoneChange = useCallback((tz: string) => {
    dispatch(updateSchedule({ timezone: tz }));
  }, [dispatch]);
  
  const handleDayOfWeekChange = useCallback((day: number) => {
    dispatch(updateSchedule({ dayOfWeek: day }));
  }, [dispatch]);
  
  const handleDayOfMonthChange = useCallback((day: number | null) => {
    if (day !== null) {
      dispatch(updateSchedule({ dayOfMonth: day }));
    }
  }, [dispatch]);
  
  const getNextRunTime = () => {
    if (!schedule.active || !schedule.startDate || !schedule.startTime) {
      return null;
    }
    
    const startDateTime = dayjs(`${schedule.startDate} ${schedule.startTime}`);
    const now = dayjs();
    
    if (schedule.type === 'immediate') {
      return 'Immediately upon export';
    }
    
    if (schedule.type === 'once') {
      return startDateTime.format('MMMM D, YYYY [at] h:mm A');
    }
    
    // For recurring schedules
    if (startDateTime.isAfter(now)) {
      return `First run: ${startDateTime.format('MMMM D, YYYY [at] h:mm A')}`;
    }
    
    // Calculate next run based on schedule type
    switch (schedule.type) {
      case 'daily':
        return `Daily at ${schedule.startTime}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Every ${days[schedule.dayOfWeek || 0]} at ${schedule.startTime}`;
      case 'monthly':
        return `Monthly on day ${schedule.dayOfMonth || 1} at ${schedule.startTime}`;
      default:
        return null;
    }
  };
  
  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];
  
  return (
    <div style={{ padding: '16px 0' }}>
      <Form layout="vertical">
        <Form.Item>
          <Space align="center" size="large">
            <Switch
              checked={schedule.active}
              onChange={handleScheduleToggle}
              checkedChildren="Scheduled"
              unCheckedChildren="Immediate"
            />
            <Text strong>
              {schedule.active ? 'Schedule this export' : 'Export immediately'}
            </Text>
          </Space>
        </Form.Item>
        
        {!schedule.active && (
          <Alert
            message="Immediate Export"
            description="The export will run immediately when you click the Export button."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        )}
        
        {schedule.active && (
          <>
            <Form.Item label="Schedule Type" required>
              <Radio.Group
                value={schedule.type}
                onChange={(e) => handleScheduleTypeChange(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="once">Run Once</Radio>
                  <Radio value="daily">Daily</Radio>
                  <Radio value="weekly">Weekly</Radio>
                  <Radio value="monthly">Monthly</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            
            <Space size="middle" style={{ width: '100%' }}>
              <Form.Item label="Start Date" required style={{ flex: 1 }}>
                <DatePicker
                  value={schedule.startDate ? dayjs(schedule.startDate) : null}
                  onChange={handleStartDateChange}
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  placeholder="Select start date"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>
              
              <Form.Item label="Start Time" required style={{ flex: 1 }}>
                <TimePicker
                  value={schedule.startTime ? dayjs(schedule.startTime, 'HH:mm') : null}
                  onChange={handleStartTimeChange}
                  format="HH:mm"
                  style={{ width: '100%' }}
                  placeholder="Select time"
                  suffixIcon={<ClockCircleOutlined />}
                />
              </Form.Item>
            </Space>
            
            {schedule.type !== 'once' && (
              <Form.Item label="End Date (Optional)">
                <DatePicker
                  value={schedule.endDate ? dayjs(schedule.endDate) : null}
                  onChange={handleEndDateChange}
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabledDate={(current) => {
                    if (!current) return false;
                    const startDate = schedule.startDate ? dayjs(schedule.startDate) : dayjs();
                    return current < startDate;
                  }}
                  placeholder="No end date (runs indefinitely)"
                  allowClear
                />
              </Form.Item>
            )}
            
            {schedule.type === 'weekly' && (
              <Form.Item label="Day of Week" required>
                <Select
                  value={schedule.dayOfWeek}
                  onChange={handleDayOfWeekChange}
                  style={{ width: '100%' }}
                  placeholder="Select day"
                >
                  <Option value={0}>Sunday</Option>
                  <Option value={1}>Monday</Option>
                  <Option value={2}>Tuesday</Option>
                  <Option value={3}>Wednesday</Option>
                  <Option value={4}>Thursday</Option>
                  <Option value={5}>Friday</Option>
                  <Option value={6}>Saturday</Option>
                </Select>
              </Form.Item>
            )}
            
            {schedule.type === 'monthly' && (
              <Form.Item label="Day of Month" required>
                <InputNumber
                  min={1}
                  max={31}
                  value={schedule.dayOfMonth}
                  onChange={handleDayOfMonthChange}
                  style={{ width: '100%' }}
                  placeholder="Enter day (1-31)"
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Note: If the day doesn't exist in a month (e.g., 31st in February), the last day of the month will be used.
                </Text>
              </Form.Item>
            )}
            
            <Form.Item label="Time Zone" required>
              <Select
                value={schedule.timezone}
                onChange={handleTimezoneChange}
                style={{ width: '100%' }}
                showSearch
                placeholder="Select timezone"
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {commonTimezones.map(tz => (
                  <Option key={tz} value={tz}>
                    {tz} ({dayjs().tz(tz).format('Z')})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            {getNextRunTime() && (
              <Alert
                message="Next Scheduled Run"
                description={getNextRunTime()}
                type="success"
                showIcon
                icon={<ClockCircleOutlined />}
                style={{ marginTop: 16 }}
              />
            )}
            
            {schedule.type !== 'once' && !schedule.endDate && (
              <Alert
                message="Recurring Schedule"
                description="This export will run indefinitely based on your schedule settings. You can set an end date to limit the duration."
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </>
        )}
        
        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            <InfoCircleOutlined /> Schedule Information
          </Title>
          <Space direction="vertical" size="small">
            <Text type="secondary">
              • Scheduled exports run automatically at the specified times
            </Text>
            <Text type="secondary">
              • Email notifications will be sent on success or failure
            </Text>
            <Text type="secondary">
              • You can view and manage scheduled exports from the Schedules page
            </Text>
            <Text type="secondary">
              • Scheduled exports use the report configuration at the time of execution
            </Text>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default SchedulePanel;