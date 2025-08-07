import React from 'react';
import { Checkbox, Select, Input, Radio, Form, Space, Typography } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectExportFormat,
  selectCurrentFormatOptions,
  setCommonOptions,
  updateCsvOptions,
  updateXlsxOptions,
  updatePdfOptions,
  selectExport
} from '../../../store/slices/exportSlice';

const { Option } = Select;
const { Text } = Typography;

const FormatOptionsPanel: React.FC = () => {
  const dispatch = useDispatch();
  const format = useSelector(selectExportFormat);
  const formatOptions = useSelector(selectCurrentFormatOptions);
  const exportState = useSelector(selectExport);
  
  // Common options that apply to all formats
  const renderCommonOptions = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text strong>Common Options</Text>
      
      <Checkbox
        checked={exportState.includeFilters}
        onChange={(e) => dispatch(setCommonOptions({ includeFilters: e.target.checked }))}
      >
        Include applied filters
      </Checkbox>
      
      <Checkbox
        checked={exportState.includeTimestamp}
        onChange={(e) => dispatch(setCommonOptions({ includeTimestamp: e.target.checked }))}
      >
        Include export timestamp
      </Checkbox>
      
      <Checkbox
        checked={exportState.includeMetadata}
        onChange={(e) => dispatch(setCommonOptions({ includeMetadata: e.target.checked }))}
      >
        Include report metadata
      </Checkbox>
    </Space>
  );
  
  // CSV-specific options
  const renderCsvOptions = () => (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Text strong>CSV Options</Text>
      
      <Form.Item label="Delimiter">
        <Radio.Group
          value={formatOptions.delimiter}
          onChange={(e) => dispatch(updateCsvOptions({ delimiter: e.target.value }))}
        >
          <Radio value=",">Comma (,)</Radio>
          <Radio value=";">Semicolon (;)</Radio>
          <Radio value="\t">Tab</Radio>
          <Radio value="|">Pipe (|)</Radio>
        </Radio.Group>
      </Form.Item>
      
      <Form.Item label="Encoding">
        <Select
          value={formatOptions.encoding}
          onChange={(value) => dispatch(updateCsvOptions({ encoding: value }))}
          style={{ width: 200 }}
        >
          <Option value="utf-8">UTF-8</Option>
          <Option value="utf-16">UTF-16</Option>
          <Option value="ascii">ASCII</Option>
        </Select>
      </Form.Item>
      
      <Checkbox
        checked={formatOptions.includeHeaders}
        onChange={(e) => dispatch(updateCsvOptions({ includeHeaders: e.target.checked }))}
      >
        Include column headers
      </Checkbox>
    </Space>
  );
  
  // Excel-specific options
  const renderXlsxOptions = () => (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Text strong>Excel Options</Text>
      
      <Form.Item label="Sheet Name">
        <Input
          value={formatOptions.sheetName}
          onChange={(e) => dispatch(updateXlsxOptions({ sheetName: e.target.value }))}
          placeholder="Report"
          maxLength={31}
          style={{ width: 200 }}
        />
      </Form.Item>
      
      <Checkbox
        checked={formatOptions.freezePanes}
        onChange={(e) => dispatch(updateXlsxOptions({ freezePanes: e.target.checked }))}
      >
        Freeze header row
      </Checkbox>
      
      <Checkbox
        checked={formatOptions.autoWidth}
        onChange={(e) => dispatch(updateXlsxOptions({ autoWidth: e.target.checked }))}
      >
        Auto-adjust column widths
      </Checkbox>
      
      <Checkbox
        checked={formatOptions.includeFormulas}
        onChange={(e) => dispatch(updateXlsxOptions({ includeFormulas: e.target.checked }))}
      >
        Include formulas (if applicable)
      </Checkbox>
    </Space>
  );
  
  // PDF-specific options
  const renderPdfOptions = () => (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Text strong>PDF Options</Text>
      
      <Form.Item label="Page Orientation">
        <Radio.Group
          value={formatOptions.orientation}
          onChange={(e) => dispatch(updatePdfOptions({ orientation: e.target.value }))}
        >
          <Radio value="portrait">Portrait</Radio>
          <Radio value="landscape">Landscape</Radio>
        </Radio.Group>
      </Form.Item>
      
      <Form.Item label="Page Size">
        <Select
          value={formatOptions.pageSize}
          onChange={(value) => dispatch(updatePdfOptions({ pageSize: value }))}
          style={{ width: 150 }}
        >
          <Option value="A4">A4</Option>
          <Option value="A3">A3</Option>
          <Option value="Letter">Letter</Option>
          <Option value="Legal">Legal</Option>
        </Select>
      </Form.Item>
      
      <Checkbox
        checked={formatOptions.includeCharts}
        onChange={(e) => dispatch(updatePdfOptions({ includeCharts: e.target.checked }))}
      >
        Include charts and visualizations
      </Checkbox>
      
      <Checkbox
        checked={formatOptions.headerFooter}
        onChange={(e) => dispatch(updatePdfOptions({ headerFooter: e.target.checked }))}
      >
        Include header and footer
      </Checkbox>
    </Space>
  );
  
  return (
    <div>
      {renderCommonOptions()}
      
      {format === 'csv' && renderCsvOptions()}
      {format === 'xlsx' && renderXlsxOptions()}
      {format === 'pdf' && renderPdfOptions()}
    </div>
  );
};

export default FormatOptionsPanel;