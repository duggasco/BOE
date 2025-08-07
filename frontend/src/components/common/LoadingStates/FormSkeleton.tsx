import React from 'react';
import { Skeleton, Space, Row, Col } from 'antd';

interface FormSkeletonProps {
  fields?: number;
  columns?: 1 | 2;
  showButtons?: boolean;
}

const FormSkeleton: React.FC<FormSkeletonProps> = ({ 
  fields = 6, 
  columns = 1,
  showButtons = true 
}) => {
  const renderField = () => (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Skeleton.Input active size="small" style={{ width: 100 }} />
      <Skeleton.Input active style={{ width: '100%' }} />
    </Space>
  );

  return (
    <div className="form-skeleton">
      <Row gutter={[16, 16]}>
        {Array.from({ length: fields }, (_, index) => (
          <Col key={index} span={columns === 2 ? 12 : 24}>
            {renderField()}
          </Col>
        ))}
      </Row>
      
      {showButtons && (
        <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Skeleton.Button active />
          <Skeleton.Button active />
        </div>
      )}
    </div>
  );
};

export default FormSkeleton;