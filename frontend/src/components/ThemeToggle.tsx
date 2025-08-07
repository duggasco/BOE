import React, { useState } from 'react';
import { Button, Dropdown, Space, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { 
  SunOutlined, 
  MoonOutlined, 
  DesktopOutlined,
  CheckOutlined 
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { mode, actualTheme, setMode } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getIcon = () => {
    if (mode === 'system') return <DesktopOutlined />;
    if (actualTheme === 'dark') return <MoonOutlined />;
    return <SunOutlined />;
  };

  const getTooltip = () => {
    if (mode === 'system') return 'System theme';
    if (actualTheme === 'dark') return 'Dark mode';
    return 'Light mode';
  };

  const items: MenuProps['items'] = [
    {
      key: 'light',
      label: (
        <Space>
          <SunOutlined />
          <span>Light</span>
          {mode === 'light' && <CheckOutlined style={{ marginLeft: 'auto' }} />}
        </Space>
      ),
      onClick: () => {
        setMode('light');
        setDropdownOpen(false);
      }
    },
    {
      key: 'dark',
      label: (
        <Space>
          <MoonOutlined />
          <span>Dark</span>
          {mode === 'dark' && <CheckOutlined style={{ marginLeft: 'auto' }} />}
        </Space>
      ),
      onClick: () => {
        setMode('dark');
        setDropdownOpen(false);
      }
    },
    {
      key: 'system',
      label: (
        <Space>
          <DesktopOutlined />
          <span>System</span>
          {mode === 'system' && <CheckOutlined style={{ marginLeft: 'auto' }} />}
        </Space>
      ),
      onClick: () => {
        setMode('system');
        setDropdownOpen(false);
      }
    }
  ];

  return (
    <Dropdown 
      menu={{ items }}
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      placement="bottomRight"
    >
      <Tooltip title={getTooltip()}>
        <Button
          type="text"
          icon={getIcon()}
          style={{
            fontSize: '18px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />
      </Tooltip>
    </Dropdown>
  );
};

export default ThemeToggle;