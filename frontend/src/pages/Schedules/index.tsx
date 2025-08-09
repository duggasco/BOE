import React, { useState } from 'react';
import { Tabs } from 'antd';
import {
  UnorderedListOutlined,
  DashboardOutlined,
  HistoryOutlined,
  FileTextOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import ScheduleList from './ScheduleList';
import ScheduleMonitor from './ScheduleMonitor';
import ScheduleHistory from './ScheduleHistory';
import TemplateManager from './TemplateManager';
import ScheduleWizard from './ScheduleWizard';

const SchedulesIndex: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/schedules/monitor')) return 'monitor';
    if (path.includes('/schedules/history')) return 'history';
    if (path.includes('/schedules/templates')) return 'templates';
    if (path.includes('/schedules/new')) return 'new';
    return 'list';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTab());

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    switch (key) {
      case 'list':
        navigate('/schedules');
        break;
      case 'monitor':
        navigate('/schedules/monitor');
        break;
      case 'history':
        navigate('/schedules/history');
        break;
      case 'templates':
        navigate('/schedules/templates');
        break;
      case 'new':
        navigate('/schedules/new');
        break;
    }
  };

  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <UnorderedListOutlined />
          Schedule List
        </span>
      ),
      children: <ScheduleList />
    },
    {
      key: 'monitor',
      label: (
        <span>
          <DashboardOutlined />
          Monitor
        </span>
      ),
      children: <ScheduleMonitor />
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined />
          History
        </span>
      ),
      children: <ScheduleHistory />
    },
    {
      key: 'templates',
      label: (
        <span>
          <FileTextOutlined />
          Templates
        </span>
      ),
      children: <TemplateManager />
    },
    {
      key: 'new',
      label: (
        <span>
          <PlusCircleOutlined />
          Create Schedule
        </span>
      ),
      children: <ScheduleWizard />
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        style={{ background: '#fff', borderRadius: 8, padding: '0 24px' }}
      />
    </div>
  );
};

export default SchedulesIndex;