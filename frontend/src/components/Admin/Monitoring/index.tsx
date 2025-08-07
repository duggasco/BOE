import React from 'react';
import { Tabs } from 'antd';
import { ClockCircleOutlined, DashboardOutlined } from '@ant-design/icons';
import ScheduleMonitor from './ScheduleMonitor';
import SystemMetrics from './SystemMetrics';

const { TabPane } = Tabs;

const Monitoring: React.FC = () => {
  return (
    <div style={{ padding: '24px', background: '#fff', minHeight: '100%' }}>
      <h2 style={{ marginBottom: 24 }}>System Monitoring</h2>
      
      <Tabs defaultActiveKey="schedules" size="large">
        <TabPane 
          tab={
            <span>
              <ClockCircleOutlined />
              Schedule Monitor
            </span>
          } 
          key="schedules"
        >
          <ScheduleMonitor />
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <DashboardOutlined />
              System Metrics
            </span>
          } 
          key="metrics"
        >
          <SystemMetrics />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Monitoring;