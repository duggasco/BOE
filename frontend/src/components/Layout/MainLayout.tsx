import React, { useState } from 'react';
import { Layout, Menu, Button, Input, Avatar, Badge, Space, Dropdown } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  FileTextOutlined,
  ScheduleOutlined,
  SettingOutlined,
  DashboardOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import ThemeToggle from '../ThemeToggle';
import { useViewport } from '../../contexts/ViewportContext';
import { InteractiveWalkthrough } from '../common/InteractiveWalkthrough';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isTablet } = useViewport();
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse sidebar on mobile
  React.useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  const menuItems = [
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: 'Reports',
      'data-tour': 'reports-menu',
    },
    {
      key: '/schedules',
      icon: <ScheduleOutlined />,
      label: 'Schedules',
      'data-tour': 'schedules-menu',
    },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: 'Admin',
      'data-tour': 'admin-menu',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        width={isMobile ? 200 : 240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: isMobile ? 1000 : 1,
          backgroundColor: 'var(--sidebar-bg)',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
        trigger={null}
      >
        <div style={{ 
          height: 64, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 8,
        }}>
          <h3 style={{ 
            color: '#fff', 
            margin: 0,
            fontSize: collapsed ? 24 : 28,
            fontWeight: 700,
            letterSpacing: collapsed ? 0 : '-0.5px',
          }}>
            {collapsed ? 'B' : 'BOE'}
          </h3>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems.map(item => ({
            ...item,
            style: { 
              fontSize: '14px',
              height: '48px',
              lineHeight: '48px',
              margin: '4px 8px',
              borderRadius: '6px',
            }
          }))}
          onClick={({ key }) => {
            navigate(key);
            if (isMobile) {
              setCollapsed(true);
            }
          }}
          style={{
            backgroundColor: 'transparent',
            borderRight: 'none',
            fontSize: '14px',
          }}
        />
      </Sider>
      <Layout style={{ 
        marginLeft: isMobile && collapsed ? 0 : (isMobile ? 200 : (collapsed ? 80 : 240)),
        transition: 'margin-left 0.2s',
        backgroundColor: 'var(--color-bg-secondary)',
        minHeight: '100vh',
      }}>
        <Header style={{ 
          padding: 0, 
          background: 'var(--color-bg-header)',
          position: 'sticky',
          width: '100%',
          top: 0,
          zIndex: 999,
          boxShadow: 'var(--color-shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: 20 }}
              />
            )}
            {!isTablet && !isMobile && (
              <div style={{ width: 300 }}>
                <Input
                  placeholder="Search..."
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  style={{ 
                    borderRadius: 20,
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                  }}
                  size="large"
                />
              </div>
            )}
          </div>
          
          <Space size={isMobile ? 8 : 16}>
            {(isTablet || isMobile) && (
              <Button
                type="text"
                icon={<SearchOutlined />}
                style={{ fontSize: 18 }}
              />
            )}
            <ThemeToggle />
            {!isMobile && (
              <Badge count={5} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 20 }} />}
                  style={{ fontSize: 20 }}
                />
              </Badge>
            )}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'profile',
                    icon: <ProfileOutlined />,
                    label: 'Profile',
                  },
                  isMobile && {
                    key: 'notifications',
                    icon: <BellOutlined />,
                    label: <Badge count={5} size="small">Notifications</Badge>,
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Logout',
                  },
                ].filter(Boolean),
              }}
              placement="bottomRight"
            >
              <Avatar 
                size={isMobile ? 32 : 36} 
                icon={<UserOutlined />}
                style={{ 
                  backgroundColor: '#1890ff',
                  cursor: 'pointer',
                }}
              />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ 
          margin: 0,
          padding: isMobile ? '16px' : isTablet ? '20px' : '24px 32px',
          minHeight: 'calc(100vh - 64px)',
          background: 'transparent',
          marginTop: 0,
        }}>
          <Outlet />
        </Content>
      </Layout>
      <InteractiveWalkthrough />
    </Layout>
  );
};

export default MainLayout;