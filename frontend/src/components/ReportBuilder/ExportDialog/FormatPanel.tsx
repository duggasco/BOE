import React from 'react';
import { Radio, Space, Divider } from 'antd';
import { FileTextOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { setFormat, selectExportFormat } from '../../../store/slices/exportSlice';
import type { ExportFormat } from '../../../store/slices/exportSlice';
import FormatOptionsPanel from './FormatOptionsPanel';

const FormatPanel: React.FC = () => {
  const dispatch = useDispatch();
  const format = useSelector(selectExportFormat);
  
  const handleFormatChange = (e: any) => {
    dispatch(setFormat(e.target.value as ExportFormat));
  };
  
  const formatOptions = [
    {
      value: 'csv',
      label: (
        <Space>
          <FileTextOutlined />
          <span>CSV</span>
        </Space>
      ),
      description: 'Comma-separated values for data analysis'
    },
    {
      value: 'xlsx',
      label: (
        <Space>
          <FileExcelOutlined />
          <span>Excel</span>
        </Space>
      ),
      description: 'Microsoft Excel workbook with formatting'
    },
    {
      value: 'pdf',
      label: (
        <Space>
          <FilePdfOutlined />
          <span>PDF</span>
        </Space>
      ),
      description: 'Portable document format for printing'
    }
  ];
  
  return (
    <div>
      <Radio.Group 
        value={format} 
        onChange={handleFormatChange}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {formatOptions.map(option => (
            <Radio.Button 
              key={option.value} 
              value={option.value}
              style={{ 
                width: '100%', 
                height: 'auto', 
                padding: '12px',
                textAlign: 'left'
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{option.label}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  {option.description}
                </div>
              </div>
            </Radio.Button>
          ))}
        </Space>
      </Radio.Group>
      
      <Divider />
      
      <FormatOptionsPanel />
    </div>
  );
};

export default FormatPanel;