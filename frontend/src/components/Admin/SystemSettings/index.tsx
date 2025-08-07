import React from 'react';
import { Tabs } from 'antd';
import {
  DatabaseOutlined,
  SettingOutlined,
  ExperimentOutlined,
  BgColorsOutlined,
} from '@ant-design/icons';
import DataSourcesTab from './DataSourcesTab';
import GlobalSettingsTab from './GlobalSettingsTab';
import FeatureFlagsTab from './FeatureFlagsTab';
import ThemeTab from './ThemeTab';

const SystemSettings: React.FC = () => {
  const items = [
    {
      key: 'datasources',
      label: (
        <span>
          <DatabaseOutlined />
          Data Sources
        </span>
      ),
      children: <DataSourcesTab />,
    },
    {
      key: 'global',
      label: (
        <span>
          <SettingOutlined />
          Global Settings
        </span>
      ),
      children: <GlobalSettingsTab />,
    },
    {
      key: 'features',
      label: (
        <span>
          <ExperimentOutlined />
          Feature Flags
        </span>
      ),
      children: <FeatureFlagsTab />,
    },
    {
      key: 'theme',
      label: (
        <span>
          <BgColorsOutlined />
          Theme
        </span>
      ),
      children: <ThemeTab />,
    },
  ];

  return (
    <Tabs
      defaultActiveKey="datasources"
      items={items}
      type="card"
      style={{ minHeight: 500 }}
    />
  );
};

export default SystemSettings;