import React from 'react';
import { Spin, Empty, Result, Button } from 'antd';
import { LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import TableSkeleton from './TableSkeleton';
import CardSkeleton from './CardSkeleton';
import ChartSkeleton from './ChartSkeleton';
import FormSkeleton from './FormSkeleton';

export interface LoadingStateProps {
  loading?: boolean;
  error?: Error | string | null;
  empty?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyType?: 'no-data' | 'no-results' | 'no-reports' | 'no-schedules' | 'no-users';
  onRetry?: () => void;
  onAction?: () => void;
  actionText?: string;
  skeleton?: React.ReactNode;
  children?: React.ReactNode;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'No Data',
  emptyDescription = 'No data available to display',
  emptyType,
  onRetry,
  onAction,
  actionText,
  skeleton,
  children,
}) => {
  // Handle error state
  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message || 'An error occurred';
    
    return (
      <Result
        status="error"
        title="Error Loading Data"
        subTitle={errorMessage}
        extra={
          onRetry && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              Retry
            </Button>
          )
        }
      />
    );
  }

  // Handle loading state with custom skeleton
  if (loading) {
    if (skeleton) {
      return <>{skeleton}</>;
    }
    
    // Default loading spinner
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 200,
        width: '100%'
      }}>
        <Spin 
          indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
          size="large"
          tip="Loading..."
        />
      </div>
    );
  }

  // Handle empty state
  if (empty && !children) {
    // Use EmptyState component if type is specified
    if (emptyType) {
      const EmptyStateComponent = require('../EmptyStates').default;
      return (
        <EmptyStateComponent
          type={emptyType}
          title={emptyMessage}
          description={emptyDescription}
          actionText={actionText}
          onAction={onAction || onRetry}
        />
      );
    }
    
    // Default empty state
    return (
      <Empty
        description={
          <div>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{emptyMessage}</div>
            <div style={{ fontSize: 14, color: '#8c8c8c' }}>{emptyDescription}</div>
          </div>
        }
        style={{ padding: '40px 0' }}
      >
        {(onAction || onRetry) && (
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={onAction || onRetry}
          >
            {actionText || 'Refresh'}
          </Button>
        )}
      </Empty>
    );
  }

  // Return children if no special state
  return <>{children}</>;
};

// Export individual skeletons for direct use
export { TableSkeleton, CardSkeleton, ChartSkeleton, FormSkeleton };

export default LoadingState;