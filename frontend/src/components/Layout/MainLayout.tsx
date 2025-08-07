import React, { useState } from 'react';
import { Layout, Menu, Button, Input, Avatar, Badge, Space } from 'antd';
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
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState(window.innerWidth < 768);

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobileView(isMobile);
      if (isMobile) {
        setCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: 'Reports',
    },
    {
      key: '/schedules',
      icon: <ScheduleOutlined />,
      label: 'Schedules',
    },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: 'Admin',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={mobileView ? 0 : 80}
        width={mobileView ? 200 : 240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: mobileView ? 'fixed' : 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: mobileView ? 1000 : 1,
          backgroundColor: '#0f1419',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
        trigger={
          mobileView ? (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                position: 'fixed',
                top: 16,
                left: collapsed ? 16 : 216,
                zIndex: 1001,
                background: '#fff',
                transition: 'left 0.2s',
              }}
            />
          ) : null
        }
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
            if (mobileView) {
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
        marginLeft: mobileView && collapsed ? 0 : (mobileView ? 200 : (collapsed ? 80 : 240)),
        transition: 'margin-left 0.2s',
        backgroundColor: '#f0f2f5',
        minHeight: '100vh',
      }}>
        <Header style={{ 
          padding: 0, 
          background: '#fff',
          position: mobileView ? 'fixed' : 'sticky',
          width: '100%',
          top: 0,
          zIndex: 999,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: mobileView ? 60 : 24,
          paddingRight: 24,
        }}>
          {mobileView ? (
            <h2 style={{ margin: 0 }}>BOE</h2>
          ) : (
            <>
              <div style={{ flex: 1, maxWidth: 400 }}>
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
              <Space size={20}>
                <Badge count={5} size="small">
                  <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 20 }} />}
                    style={{ fontSize: 20 }}
                  />
                </Badge>
                <Avatar 
                  size={36} 
                  icon={<UserOutlined />}
                  style={{ 
                    backgroundColor: '#1890ff',
                    cursor: 'pointer',
                  }}
                />
              </Space>
            </>
          )}
        </Header>
        <Content style={{ 
          margin: 0,
          padding: '24px 32px',
          minHeight: 'calc(100vh - 64px)',
          background: 'transparent',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;