import React from 'react';
import { Card, Empty } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';

const ScheduleManager: React.FC = () => {
  return (
    <Card 
      title={
        <span style={{ fontSize: '20px', fontWeight: 600 }}>Schedule Manager</span>
      }
      style={{
        width: '100%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        borderRadius: '8px',
      }}
    >
      <div style={{ 
        padding: '100px 20px',
        textAlign: 'center',
        minHeight: 500,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Empty
          image={<CalendarOutlined style={{ fontSize: 72, color: '#bfbfbf' }} />}
          description={
            <span style={{ fontSize: 18, color: '#595959' }}>
              Schedule management coming soon
            </span>
          }
        />
      </div>
    </Card>
  );
};

export default ScheduleManager;