import React from 'react';
import { Card, Tabs, Empty } from 'antd';
import { SettingOutlined, UserOutlined, DatabaseOutlined } from '@ant-design/icons';
import FieldManagement from '../components/Admin/FieldManagement';
import UserManagement from '../components/Admin/UserManagement';

const AdminPanel: React.FC = () => {
  const EmptyState = ({ title }: { title: string }) => (
    <div style={{ 
      padding: '60px 20px',
      textAlign: 'center',
    }}>
      <Empty
        description={
          <span style={{ fontSize: 16, color: '#595959' }}>
            {title} coming soon
          </span>
        }
      />
    </div>
  );

  const items = [
    { 
      key: 'fields', 
      label: (
        <span>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          Field Management
        </span>
      ),
      children: <FieldManagement />
    },
    { 
      key: 'users', 
      label: (
        <span>
          <UserOutlined style={{ marginRight: 8 }} />
          User Management
        </span>
      ),
      children: <UserManagement />
    },
    { 
      key: 'system', 
      label: (
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          System Settings
        </span>
      ),
      children: <EmptyState title="System settings" />
    },
  ];

  return (
    <Card 
      title={
        <span style={{ fontSize: '20px', fontWeight: 600 }}>Administration</span>
      }
      style={{
        width: '100%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        borderRadius: '8px',
      }}
    >
      <Tabs 
        items={items}
        type="card"
        style={{ minHeight: 500 }}
        tabBarStyle={{
          marginBottom: 24,
          borderBottom: '1px solid #f0f0f0',
        }}
        size="large"
      />
    </Card>
  );
};

export default AdminPanel;