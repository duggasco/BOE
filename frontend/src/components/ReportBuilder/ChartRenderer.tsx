import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Card, Empty, Select, Space, Typography } from 'antd';
import { BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons';
import type { ChartConfig, ChartType } from '../../types/report';

const { Text } = Typography;
const { Option } = Select;

interface ChartRendererProps {
  data: any[];
  config: ChartConfig;
  dimensions: string[];
  measures: string[];
  dimensionFields?: Field[]; // Full field metadata
  measureFields?: Field[]; // Full field metadata
  width?: number;
  height?: number;
  onConfigChange?: (config: Partial<ChartConfig>) => void;
  editable?: boolean;
}

// Color palette for charts - Business Objects style
const CHART_COLORS = [
  '#2E7D32', // Green
  '#1565C0', // Blue
  '#E65100', // Orange
  '#B71C1C', // Red
  '#5E35B1', // Purple
  '#00695C', // Teal
  '#F57C00', // Amber
  '#AD1457', // Pink
  '#37474F', // Blue Grey
  '#4E342E', // Brown
];

const ChartRenderer: React.FC<ChartRendererProps> = ({
  data,
  config,
  dimensions,
  measures,
  dimensionFields = [],
  measureFields = [],
  width = '100%',
  height = 400,
  onConfigChange,
  editable = false,
}) => {
  // Transform data for charts
  const transformedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // For pie charts, we need to aggregate if there are multiple rows
    if (config.type === 'pie' && data.length > 10) {
      // Take top 10 and group rest as "Others"
      const sorted = [...data].sort((a, b) => {
        const measureField = measures[0];
        return (b[measureField] || 0) - (a[measureField] || 0);
      });
      
      const top10 = sorted.slice(0, 10);
      const others = sorted.slice(10);
      
      if (others.length > 0) {
        const othersSum = others.reduce((sum, item) => {
          return sum + (item[measures[0]] || 0);
        }, 0);
        
        return [
          ...top10,
          { [dimensions[0]]: 'Others', [measures[0]]: othersSum }
        ];
      }
      
      return top10;
    }
    
    return data;
  }, [data, config.type, dimensions, measures]);

  // Format number for display
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  // Format tooltip values based on field metadata
  const formatTooltipValue = (value: number, name: string): [string, string] => {
    // Find field metadata
    const field = [...(measureFields || []), ...(dimensionFields || [])]
      .find(f => f.fieldId === name || f.displayName === name);
    
    if (field) {
      // Use semantic type for formatting
      if (field.semanticType === 'percentage') {
        const decimals = field.format?.decimals ?? 2;
        return [`${value.toFixed(decimals)}%`, field.displayName];
      }
      if (field.semanticType === 'currency') {
        const decimals = field.format?.decimals ?? 0;
        const prefix = field.unit === 'USD' ? '$' : field.format?.prefix || '';
        return [`${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: decimals })}`, field.displayName];
      }
      if (field.format?.type === 'number') {
        const decimals = field.format?.decimals ?? 0;
        return [value.toLocaleString('en-US', { maximumFractionDigits: decimals }), field.displayName];
      }
    }
    
    // Fallback to basic formatting
    return [value.toLocaleString('en-US'), name];
  };

  // Render chart based on type
  const renderChart = () => {
    if (!transformedData || transformedData.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No data available for chart"
        />
      );
    }

    const commonProps = {
      data: transformedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (config.type) {
      case 'line':
        return (
          <ResponsiveContainer width={width} height={height}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey={dimensions[0]} 
                stroke="#666"
                tick={{ fontSize: 12 }}
                angle={config.xAxisRotation || 0}
                textAnchor={config.xAxisRotation ? "end" : "middle"}
              />
              <YAxis 
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={formatNumber}
              />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              {measures.map((measure, index) => (
                <Line
                  key={measure}
                  type={config.lineType || 'monotone'}
                  dataKey={measure}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width={width} height={height}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey={dimensions[0]} 
                stroke="#666"
                tick={{ fontSize: 12 }}
                angle={config.xAxisRotation || 0}
                textAnchor={config.xAxisRotation ? "end" : "middle"}
              />
              <YAxis 
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={formatNumber}
              />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              {measures.map((measure, index) => (
                <Bar
                  key={measure}
                  dataKey={measure}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieDataKey = measures[0] || 'value';
        const pieLabelKey = dimensions[0] || 'name';
        
        return (
          <ResponsiveContainer width={width} height={height}>
            <PieChart>
              <Pie
                data={transformedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey={pieDataKey}
                nameKey={pieLabelKey}
              >
                {transformedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width={width} height={height}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey={dimensions[0]} 
                stroke="#666"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={formatNumber}
              />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              {measures.map((measure, index) => (
                <Area
                  key={measure}
                  type="monotone"
                  dataKey={measure}
                  stackId={config.stacked ? "1" : undefined}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <Empty
            description={`Chart type "${config.type}" not supported`}
          />
        );
    }
  };

  // Generate default config for a chart type
  const getDefaultConfigForType = (type: ChartType): Partial<ChartConfig> => {
    const base = {
      type,
      xAxis: dimensions[0],
      yAxis: measures,
      legend: true,
      showDataLabels: false,
    };
    
    switch (type) {
      case 'line':
        return { ...base, lineType: 'monotone' as const };
      case 'bar':
        return { ...base, xAxisRotation: 0 };
      case 'pie':
        return { 
          type: 'pie' as const,
          legend: true,
          showDataLabels: true,
        };
      case 'area':
        return { ...base, stacked: false };
      default:
        return base;
    }
  };

  // Chart type selector for edit mode
  const renderChartTypeSelector = () => {
    if (!editable || !onConfigChange) return null;

    const handleTypeChange = (newType: ChartType) => {
      // Create fresh config for new type, preserving only essential properties
      const newConfig = getDefaultConfigForType(newType);
      onConfigChange?.(newConfig);
    };

    return (
      <Space style={{ marginBottom: 16 }}>
        <Text>Chart Type:</Text>
        <Select
          value={config.type}
          onChange={handleTypeChange}
          style={{ width: 120 }}
        >
          <Option value="line">
            <LineChartOutlined /> Line
          </Option>
          <Option value="bar">
            <BarChartOutlined /> Bar
          </Option>
          <Option value="pie">
            <PieChartOutlined /> Pie
          </Option>
          <Option value="area">
            <BarChartOutlined /> Area
          </Option>
        </Select>
        
        {config.type === 'line' && (
          <Select
            value={config.lineType || 'monotone'}
            onChange={(lineType) => onConfigChange({ lineType })}
            style={{ width: 120 }}
          >
            <Option value="monotone">Smooth</Option>
            <Option value="linear">Linear</Option>
            <Option value="step">Step</Option>
          </Select>
        )}
        
        {(config.type === 'bar' || config.type === 'line') && (
          <Select
            value={config.xAxisRotation || 0}
            onChange={(rotation) => onConfigChange({ xAxisRotation: rotation })}
            style={{ width: 140 }}
          >
            <Option value={0}>Labels: Horizontal</Option>
            <Option value={-45}>Labels: Rotated</Option>
          </Select>
        )}
        
        {config.type === 'area' && (
          <Select
            value={config.stacked ? 'stacked' : 'normal'}
            onChange={(value) => onConfigChange({ stacked: value === 'stacked' })}
            style={{ width: 120 }}
          >
            <Option value="normal">Normal</Option>
            <Option value="stacked">Stacked</Option>
          </Select>
        )}
      </Space>
    );
  };

  return (
    <div className="chart-renderer">
      {renderChartTypeSelector()}
      <div style={{ width: '100%', height: editable ? height : '100%' }}>
        {renderChart()}
      </div>
    </div>
  );
};

export default ChartRenderer;