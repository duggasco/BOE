import React, { useEffect } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  InputNumber, 
  Switch, 
  Space, 
  Typography, 
  Alert,
  Tooltip,
  Button
} from 'antd';
import { 
  CalendarOutlined, 
  FunctionOutlined,
  QuestionCircleOutlined 
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectExportPrompts,
  selectExport,
  updatePromptValue,
  setPromptExpression,
  setAvailablePrompts
} from '../../../store/slices/exportSlice';
import type { PromptValue } from '../../../store/slices/exportSlice';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
const { Option } = Select;

// Mock prompts for demonstration - in real app, these would come from the report definition
const mockPrompts: PromptValue[] = [
  {
    promptId: 'dateRange',
    displayName: 'Date Range',
    type: 'static',
    value: null
  },
  {
    promptId: 'department',
    displayName: 'Department',
    type: 'static',
    value: null
  },
  {
    promptId: 'threshold',
    displayName: 'Minimum Threshold',
    type: 'static',
    value: 1000
  }
];

// Common dynamic expressions for date prompts
const DATE_EXPRESSIONS = [
  { value: 'TODAY()', label: 'Today' },
  { value: 'TODAY()-1', label: 'Yesterday' },
  { value: 'TODAY()-7', label: '7 days ago' },
  { value: 'MONTH_START()', label: 'Start of month' },
  { value: 'MONTH_END()', label: 'End of month' },
  { value: 'QUARTER_START()', label: 'Start of quarter' },
  { value: 'QUARTER_END()', label: 'End of quarter' },
  { value: 'YEAR_START()', label: 'Start of year' },
  { value: 'YEAR_END()', label: 'End of year' }
];

const PromptPanel: React.FC = () => {
  const dispatch = useDispatch();
  const promptValues = useSelector(selectExportPrompts);
  const exportState = useSelector(selectExport);
  
  // Initialize prompts when component mounts
  useEffect(() => {
    // In real app, fetch prompts based on reportId
    if (exportState.availablePrompts.length === 0) {
      dispatch(setAvailablePrompts(mockPrompts));
    }
  }, [dispatch, exportState.availablePrompts.length]);
  
  const renderPromptInput = (prompt: PromptValue) => {
    const isDynamic = prompt.type === 'dynamic';
    
    // Determine input type based on prompt characteristics
    // In real app, this would come from prompt metadata
    const getInputComponent = () => {
      switch (prompt.promptId) {
        case 'dateRange':
          if (isDynamic) {
            return (
              <Select
                value={prompt.expression}
                onChange={(value) => dispatch(setPromptExpression({ 
                  promptId: prompt.promptId, 
                  expression: value 
                }))}
                style={{ width: '100%' }}
                placeholder="Select or enter expression"
                allowClear
              >
                {DATE_EXPRESSIONS.map(expr => (
                  <Option key={expr.value} value={expr.value}>
                    {expr.label} ({expr.value})
                  </Option>
                ))}
              </Select>
            );
          }
          return (
            <DatePicker.RangePicker
              value={prompt.value ? [dayjs(prompt.value[0]), dayjs(prompt.value[1])] : undefined}
              onChange={(dates) => {
                if (dates) {
                  dispatch(updatePromptValue({
                    promptId: prompt.promptId,
                    value: [dates[0]?.toISOString(), dates[1]?.toISOString()]
                  }));
                }
              }}
              style={{ width: '100%' }}
            />
          );
          
        case 'department':
          return (
            <Select
              value={prompt.value}
              onChange={(value) => dispatch(updatePromptValue({ 
                promptId: prompt.promptId, 
                value 
              }))}
              style={{ width: '100%' }}
              placeholder="Select department"
              mode="multiple"
            >
              <Option value="sales">Sales</Option>
              <Option value="marketing">Marketing</Option>
              <Option value="engineering">Engineering</Option>
              <Option value="hr">Human Resources</Option>
              <Option value="finance">Finance</Option>
            </Select>
          );
          
        case 'threshold':
          return (
            <InputNumber
              value={prompt.value}
              onChange={(value) => dispatch(updatePromptValue({ 
                promptId: prompt.promptId, 
                value 
              }))}
              style={{ width: '100%' }}
              min={0}
              step={100}
              formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value!.replace(/\$\s?|(,*)/g, '')}
            />
          );
          
        default:
          if (isDynamic) {
            return (
              <Input
                value={prompt.expression}
                onChange={(e) => dispatch(setPromptExpression({ 
                  promptId: prompt.promptId, 
                  expression: e.target.value 
                }))}
                placeholder="Enter expression"
                prefix={<FunctionOutlined />}
              />
            );
          }
          return (
            <Input
              value={prompt.value}
              onChange={(e) => dispatch(updatePromptValue({ 
                promptId: prompt.promptId, 
                value: e.target.value 
              }))}
              placeholder="Enter value"
            />
          );
      }
    };
    
    return (
      <Form.Item
        key={prompt.promptId}
        label={
          <Space>
            <Text>{prompt.displayName}</Text>
            <Tooltip title={`Prompt ID: ${prompt.promptId}`}>
              <QuestionCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {isDynamic ? 'Dynamic (evaluated at runtime)' : 'Static value'}
            </Text>
            <Switch
              checkedChildren="Dynamic"
              unCheckedChildren="Static"
              checked={isDynamic}
              onChange={(checked) => {
                if (checked) {
                  dispatch(setPromptExpression({ 
                    promptId: prompt.promptId, 
                    expression: '' 
                  }));
                } else {
                  dispatch(updatePromptValue({ 
                    promptId: prompt.promptId, 
                    value: null 
                  }));
                }
              }}
              size="small"
            />
          </Space>
          {getInputComponent()}
          {isDynamic && prompt.expression && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              <CalendarOutlined /> This will be evaluated when the report runs
            </Text>
          )}
        </Space>
      </Form.Item>
    );
  };
  
  if (exportState.availablePrompts.length === 0) {
    return (
      <Alert
        message="No Prompts Available"
        description="This report doesn't have any prompts configured."
        type="info"
        showIcon
      />
    );
  }
  
  return (
    <div>
      <Alert
        message="Report Prompts"
        description="Set values for report prompts. Use static values for fixed data or dynamic expressions for runtime evaluation."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form layout="vertical">
        {exportState.availablePrompts.map(prompt => {
          const currentValue = promptValues[prompt.promptId] || prompt;
          return renderPromptInput(currentValue);
        })}
      </Form>
      
      <Paragraph type="secondary" style={{ fontSize: '12px', marginTop: 16 }}>
        <strong>Dynamic Expressions:</strong> Use expressions like TODAY(), MONTH_START(), or custom formulas 
        that will be evaluated each time the scheduled report runs. This is useful for reports that need 
        to automatically adjust their date ranges or other parameters.
      </Paragraph>
    </div>
  );
};

export default PromptPanel;