import React from 'react';
import { Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showActions?: boolean;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  columns = 4, 
  rows = 5,
  showActions = false 
}) => {
  // Generate skeleton columns
  const skeletonColumns: ColumnsType<any> = Array.from({ length: columns }, (_, index) => ({
    title: <Skeleton.Input active size="small" style={{ width: 80 + Math.random() * 40 }} />,
    dataIndex: `col${index}`,
    key: `col${index}`,
    render: () => (
      <Skeleton.Input 
        active 
        size="small" 
        style={{ width: 100 + Math.random() * 50 }} 
      />
    ),
  }));

  // Add actions column if needed
  if (showActions) {
    skeletonColumns.push({
      title: <Skeleton.Input active size="small" style={{ width: 60 }} />,
      key: 'actions',
      render: () => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton.Button active size="small" />
          <Skeleton.Button active size="small" />
        </div>
      ),
    });
  }

  // Generate skeleton data
  const skeletonData = Array.from({ length: rows }, (_, index) => ({
    key: index,
    ...Object.fromEntries(
      Array.from({ length: columns }, (_, colIndex) => [`col${colIndex}`, ''])
    ),
  }));

  return (
    <Table
      columns={skeletonColumns}
      dataSource={skeletonData}
      pagination={false}
      bordered={false}
      className="skeleton-table"
    />
  );
};

export default TableSkeleton;