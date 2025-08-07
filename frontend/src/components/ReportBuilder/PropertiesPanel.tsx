import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, InputNumber, Switch, Slider, Empty, Divider, Space } from 'antd';
import { useDispatch } from 'react-redux';
import type { ReportSection, ChartConfig, TableConfig } from '../../types';
import { updateSection } from '../../store/slices/reportBuilderSlice';
import type { AppDispatch } from '../../store';
import debounce from 'lodash/debounce';

interface PropertiesPanelProps {
  selectedSectionId: string | null;
  sections: ReportSection[];
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedSectionId, sections }) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedSection = sections.find(s => s.id === selectedSectionId);
  
  // Local state for text inputs to enable immediate UI feedback
  const [localTextContent, setLocalTextContent] = useState('');
  const [localChartTitle, setLocalChartTitle] = useState('');
  
  // Initialize local state when section changes
  useEffect(() => {
    if (selectedSection) {
      setLocalTextContent(selectedSection.textContent || '');
      setLocalChartTitle(selectedSection.chartConfig?.title || '');
    }
  }, [selectedSection?.id]);
  
  // Create debounced update functions
  const debouncedUpdateText = useCallback(
    debounce((sectionId: string, content: string) => {
      dispatch(updateSection({
        id: sectionId,
        updates: { textContent: content }
      }));
    }, 500),
    [dispatch]
  );
  
  const debouncedUpdateChartTitle = useCallback(
    debounce((sectionId: string, title: string) => {
      dispatch(updateSection({
        id: sectionId,
        updates: {
          chartConfig: {
            ...selectedSection?.chartConfig,
            title
          } as ChartConfig
        }
      }));
    }, 500),
    [dispatch, selectedSection?.chartConfig]
  );

  if (!selectedSection) {
    return (
      <Card title="Properties" size="small">
        <Empty description="Select a section to view properties" />
      </Card>
    );
  }

  // Helper function for immediate updates (no debouncing needed)
  const handleImmediateUpdate = (updates: Partial<ReportSection>) => {
    dispatch(updateSection({
      id: selectedSection.id,
      updates
    }));
  };

  // Handle table config updates
  const handleTableConfigUpdate = (key: keyof TableConfig, value: any) => {
    const newTableConfig: TableConfig = {
      ...selectedSection.tableConfig,
      columns: selectedSection.tableConfig?.columns || [],
      [key]: value
    };
    handleImmediateUpdate({ tableConfig: newTableConfig });
  };

  // Handle chart config updates
  const handleChartConfigUpdate = (key: keyof ChartConfig, value: any) => {
    const newChartConfig: ChartConfig = {
      ...selectedSection.chartConfig,
      type: selectedSection.chartConfig?.type || 'bar',
      [key]: value
    };
    handleImmediateUpdate({ chartConfig: newChartConfig });
  };

  // Handle text content changes
  const handleTextContentChange = (value: string) => {
    setLocalTextContent(value);
    debouncedUpdateText(selectedSection.id, value);
  };
  
  // Handle chart title changes
  const handleChartTitleChange = (value: string) => {
    setLocalChartTitle(value);
    debouncedUpdateChartTitle(selectedSection.id, value);
  };

  return (
    <Card title="Properties" size="small">
      <Form layout="vertical" size="small">
        <Form.Item label="Section Type">
          <Input value={selectedSection.type} disabled />
        </Form.Item>
        
        <Divider style={{ margin: '12px 0' }} />
        
        {/* Table Properties */}
        {selectedSection.type === 'table' && (
          <>
            <Form.Item label="Rows Per Page">
              <Select 
                value={selectedSection.tableConfig?.pageSize || 25}
                onChange={(value) => handleTableConfigUpdate('pageSize', value)}
                style={{ width: '100%' }}
              >
                <Select.Option value={10}>10</Select.Option>
                <Select.Option value={25}>25</Select.Option>
                <Select.Option value={50}>50</Select.Option>
                <Select.Option value={100}>100</Select.Option>
                <Select.Option value={-1}>All</Select.Option>
              </Select>
            </Form.Item>
            
            <Form.Item label="Features">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Show Row Numbers</span>
                  <Switch 
                    size="small"
                    checked={selectedSection.tableConfig?.showRowNumbers || false}
                    onChange={(checked) => handleTableConfigUpdate('showRowNumbers', checked)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Enable Sorting</span>
                  <Switch 
                    size="small"
                    checked={selectedSection.tableConfig?.enableSorting !== false}
                    onChange={(checked) => handleTableConfigUpdate('enableSorting', checked)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Enable Filtering</span>
                  <Switch 
                    size="small"
                    checked={selectedSection.tableConfig?.enableFiltering !== false}
                    onChange={(checked) => handleTableConfigUpdate('enableFiltering', checked)}
                  />
                </div>
              </Space>
            </Form.Item>
          </>
        )}
        
        {/* Chart Properties */}
        {selectedSection.type === 'chart' && (
          <>
            <Form.Item label="Chart Type">
              <Select 
                value={selectedSection.chartConfig?.type || 'bar'}
                onChange={(value) => handleChartConfigUpdate('type', value)}
                style={{ width: '100%' }}
              >
                <Select.Option value="bar">Bar</Select.Option>
                <Select.Option value="line">Line</Select.Option>
                <Select.Option value="pie">Pie</Select.Option>
                <Select.Option value="area">Area</Select.Option>
                <Select.Option value="scatter">Scatter</Select.Option>
              </Select>
            </Form.Item>
            
            <Form.Item label="Chart Title">
              <Input 
                value={localChartTitle}
                onChange={(e) => handleChartTitleChange(e.target.value)}
                placeholder="Enter chart title"
              />
            </Form.Item>
            
            <Form.Item label="Options">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Show Legend</span>
                  <Switch 
                    size="small"
                    checked={selectedSection.chartConfig?.legend !== false}
                    onChange={(checked) => handleChartConfigUpdate('legend', checked)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Show Data Labels</span>
                  <Switch 
                    size="small"
                    checked={selectedSection.chartConfig?.showDataLabels || false}
                    onChange={(checked) => handleChartConfigUpdate('showDataLabels', checked)}
                  />
                </div>
                {(selectedSection.chartConfig?.type === 'bar' || 
                  selectedSection.chartConfig?.type === 'area') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stacked</span>
                    <Switch 
                      size="small"
                      checked={selectedSection.chartConfig?.stacked || false}
                      onChange={(checked) => handleChartConfigUpdate('stacked', checked)}
                    />
                  </div>
                )}
              </Space>
            </Form.Item>
            
            {(selectedSection.chartConfig?.type === 'bar' || 
              selectedSection.chartConfig?.type === 'line') && (
              <Form.Item label="X-Axis Label Rotation">
                <Slider 
                  min={-90} 
                  max={90} 
                  value={selectedSection.chartConfig?.xAxisRotation || 0}
                  onChange={(value) => handleChartConfigUpdate('xAxisRotation', value)}
                  marks={{
                    '-90': '-90°',
                    '-45': '-45°',
                    '0': '0°',
                    '45': '45°',
                    '90': '90°'
                  }}
                />
              </Form.Item>
            )}
          </>
        )}
        
        {/* Text Properties */}
        {selectedSection.type === 'text' && (
          <>
            <Form.Item label="Content">
              <Input.TextArea 
                value={localTextContent}
                onChange={(e) => handleTextContentChange(e.target.value)}
                placeholder="Enter text content (markdown supported)"
                rows={6}
              />
            </Form.Item>
            
            <Form.Item label="Font Size">
              <InputNumber 
                min={10} 
                max={48} 
                value={selectedSection.formatting?.fontSize || 14}
                onChange={(value) => handleImmediateUpdate({
                  formatting: {
                    ...selectedSection.formatting,
                    fontSize: value || 14
                  }
                })}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}
        
        {/* Container Properties */}
        {selectedSection.type === 'container' && (
          <>
            <Form.Item label="Background Color">
              <Input 
                type="color" 
                value={selectedSection.formatting?.backgroundColor || '#ffffff'}
                onChange={(e) => handleImmediateUpdate({
                  formatting: {
                    ...selectedSection.formatting,
                    backgroundColor: e.target.value
                  }
                })}
                style={{ width: '100%', height: '32px' }}
              />
            </Form.Item>
            
            <Form.Item label="Padding">
              <InputNumber 
                min={0} 
                max={50} 
                value={selectedSection.formatting?.padding || 8}
                onChange={(value) => handleImmediateUpdate({
                  formatting: {
                    ...selectedSection.formatting,
                    padding: value || 8
                  }
                })}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}
        
        {/* Common Layout Properties */}
        <Divider style={{ margin: '12px 0' }}>Layout</Divider>
        
        <Form.Item label="Width (grid columns)">
          <InputNumber 
            min={1} 
            max={12} 
            value={selectedSection.layout.w}
            onChange={(value) => handleImmediateUpdate({
              layout: {
                ...selectedSection.layout,
                w: value || 6
              }
            })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Form.Item label="Height (grid rows)">
          <InputNumber 
            min={1} 
            max={20} 
            value={selectedSection.layout.h}
            onChange={(value) => handleImmediateUpdate({
              layout: {
                ...selectedSection.layout,
                h: value || 6
              }
            })}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PropertiesPanel;