import React from 'react';
import { Empty, Button } from 'antd';
import {
  FileTextOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  DatabaseOutlined,
  UserOutlined,
  CalendarOutlined,
  BarChartOutlined,
  InboxOutlined,
  CloudUploadOutlined,
  TeamOutlined,
  SettingOutlined,
  FilterOutlined,
} from '@ant-design/icons';

export type EmptyStateType = 
  | 'no-data'
  | 'no-results'
  | 'no-reports'
  | 'no-schedules'
  | 'no-users'
  | 'no-permissions'
  | 'no-charts'
  | 'no-files'
  | 'no-fields'
  | 'no-filters'
  | 'no-configuration'
  | 'error'
  | 'custom';

interface EmptyStateConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
}

const emptyStateConfigs: Record<EmptyStateType, EmptyStateConfig> = {
  'no-data': {
    icon: <InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Data Available',
    description: 'There is no data to display at the moment.',
  },
  'no-results': {
    icon: <SearchOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Results Found',
    description: 'Try adjusting your search or filter criteria.',
  },
  'no-reports': {
    icon: <FileTextOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Reports Yet',
    description: 'Create your first report to get started with data analysis.',
    actionText: 'Create Report',
  },
  'no-schedules': {
    icon: <CalendarOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Schedules',
    description: 'You haven\'t scheduled any reports yet.',
    actionText: 'Schedule Report',
  },
  'no-users': {
    icon: <UserOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Users Found',
    description: 'No users match your current filters.',
  },
  'no-permissions': {
    icon: <TeamOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Permissions Set',
    description: 'Configure permissions to control access to resources.',
    actionText: 'Configure Permissions',
  },
  'no-charts': {
    icon: <BarChartOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Charts Available',
    description: 'Add data to create visualizations.',
  },
  'no-files': {
    icon: <FolderOpenOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Files',
    description: 'Upload or generate files to see them here.',
    actionText: 'Upload Files',
  },
  'no-fields': {
    icon: <DatabaseOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Fields Configured',
    description: 'Add fields to start building your data model.',
    actionText: 'Add Field',
  },
  'no-filters': {
    icon: <FilterOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Filters Applied',
    description: 'Add filters to refine your data view.',
    actionText: 'Add Filter',
  },
  'no-configuration': {
    icon: <SettingOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'Not Configured',
    description: 'This feature requires configuration before use.',
    actionText: 'Configure',
  },
  'error': {
    icon: <CloudUploadOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />,
    title: 'Something Went Wrong',
    description: 'We encountered an error while loading this content.',
    actionText: 'Try Again',
  },
  'custom': {
    icon: <InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
    title: 'No Content',
    description: 'No content to display.',
  },
};

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  showAction?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-data',
  icon,
  title,
  description,
  actionText,
  onAction,
  showAction = true,
  style,
  className,
}) => {
  const config = emptyStateConfigs[type];
  
  // Use provided props or fall back to config
  const finalIcon = icon || config.icon;
  const finalTitle = title || config.title;
  const finalDescription = description || config.description;
  const finalActionText = actionText || config.actionText;

  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        minHeight: 300,
        ...style,
      }}
    >
      <Empty
        image={finalIcon}
        description={
          <div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 500, 
              marginBottom: 8,
              color: 'var(--color-text-primary)'
            }}>
              {finalTitle}
            </div>
            <div style={{ 
              fontSize: 14, 
              color: 'var(--color-text-secondary)' 
            }}>
              {finalDescription}
            </div>
          </div>
        }
      >
        {showAction && finalActionText && (
          <Button 
            type="primary" 
            onClick={onAction}
            style={{ marginTop: 16 }}
          >
            {finalActionText}
          </Button>
        )}
      </Empty>
    </div>
  );
};

export default EmptyState;