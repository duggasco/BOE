import React from 'react';
import { Card, Skeleton, Space } from 'antd';

interface CardSkeletonProps {
  hasTitle?: boolean;
  hasAvatar?: boolean;
  hasActions?: boolean;
  paragraphs?: number;
  loading?: boolean;
}

const CardSkeleton: React.FC<CardSkeletonProps> = ({
  hasTitle = true,
  hasAvatar = false,
  hasActions = false,
  paragraphs = 3,
  loading = true,
}) => {
  return (
    <Card
      style={{ width: '100%' }}
      actions={
        hasActions && loading
          ? [
              <Skeleton.Button key="1" active size="small" />,
              <Skeleton.Button key="2" active size="small" />,
              <Skeleton.Button key="3" active size="small" />,
            ]
          : undefined
      }
    >
      <Skeleton
        loading={loading}
        active
        avatar={hasAvatar}
        title={hasTitle}
        paragraph={{ rows: paragraphs, width: ['100%', '90%', '75%'] }}
      />
    </Card>
  );
};

export default CardSkeleton;