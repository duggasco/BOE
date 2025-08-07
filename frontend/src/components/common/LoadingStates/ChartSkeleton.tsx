import React from 'react';
import { Card, Skeleton } from 'antd';

interface ChartSkeletonProps {
  height?: number;
  title?: string;
  type?: 'line' | 'bar' | 'pie' | 'area';
}

const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ 
  height = 300, 
  title = 'Loading Chart...',
  type = 'line' 
}) => {
  const renderChartPlaceholder = () => {
    switch (type) {
      case 'bar':
        return (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: height - 60, padding: '20px 0' }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: '#f0f0f0',
                  height: `${30 + Math.random() * 70}%`,
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.6 + (i % 2) * 0.2,
                }}
              />
            ))}
          </div>
        );
      
      case 'pie':
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: height - 60 }}>
            <div
              style={{
                width: Math.min(height - 80, 200),
                height: Math.min(height - 80, 200),
                borderRadius: '50%',
                background: 'conic-gradient(#f0f0f0 0deg 90deg, #e8e8e8 90deg 180deg, #f5f5f5 180deg 270deg, #e0e0e0 270deg)',
              }}
            />
          </div>
        );
      
      case 'area':
      case 'line':
      default:
        return (
          <div style={{ padding: '20px 0', height: height - 60 }}>
            <div style={{ 
              width: '100%', 
              height: '100%', 
              background: 'linear-gradient(180deg, #f5f5f5 0%, #f0f0f0 50%, #f5f5f5 100%)',
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                bottom: '30%',
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: '#e0e0e0',
              }} />
              <div style={{
                position: 'absolute',
                bottom: '50%',
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: '#e8e8e8',
              }} />
              <div style={{
                position: 'absolute',
                bottom: '70%',
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: '#e8e8e8',
              }} />
            </div>
          </div>
        );
    }
  };

  return (
    <Card
      title={<Skeleton.Input active size="small" style={{ width: 150 }} />}
      style={{ width: '100%', height }}
      styles={{ body: { padding: '12px', height: '100%' } }}
    >
      {renderChartPlaceholder()}
    </Card>
  );
};

export default ChartSkeleton;