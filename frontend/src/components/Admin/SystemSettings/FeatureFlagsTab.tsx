import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Switch,
  Tag,
  Typography,
  Alert,
  message,
  Spin,
  Badge,
  Tooltip,
  Progress,
} from 'antd';
import {
  ExperimentOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  ApiOutlined,
  TeamOutlined,
  RobotOutlined,
  CloudOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { FeatureFlag } from '../../../types/settings';
import { settingsApi } from '../../../services/settingsApi';

const { Text, Title } = Typography;

// Icon mapping for feature categories
const categoryIcons: Record<string, React.ReactNode> = {
  Analytics: <BulbOutlined />,
  Export: <CloudOutlined />,
  AI: <RobotOutlined />,
  Collaboration: <TeamOutlined />,
  Performance: <ThunderboltOutlined />,
  API: <ApiOutlined />,
};

const FeatureFlagsTab: React.FC = () => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadFeatureFlags();
  }, []);

  const loadFeatureFlags = async () => {
    setLoading(true);
    try {
      const flags = await settingsApi.getFeatureFlags();
      setFeatureFlags(flags);
    } catch (error) {
      message.error('Failed to load feature flags');
      console.error('Error loading feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (flagId: string) => {
    setToggling(flagId);
    try {
      const updatedFlag = await settingsApi.toggleFeatureFlag(flagId);
      setFeatureFlags(prev =>
        prev.map(flag => (flag.id === flagId ? updatedFlag : flag))
      );
      message.success(
        `Feature "${updatedFlag.name}" ${
          updatedFlag.enabled ? 'enabled' : 'disabled'
        } successfully`
      );
    } catch (error) {
      message.error('Failed to toggle feature flag');
      console.error('Error toggling feature flag:', error);
    } finally {
      setToggling(null);
    }
  };

  const getFeatureCardColor = (flag: FeatureFlag) => {
    if (!flag.enabled) return '#fafafa';
    if (flag.rolloutPercentage && flag.rolloutPercentage < 100) return '#fff7e6';
    return '#f6ffed';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Analytics: 'blue',
      Export: 'green',
      AI: 'purple',
      Collaboration: 'orange',
      Performance: 'red',
      API: 'cyan',
    };
    return colors[category] || 'default';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading feature flags..." />
      </div>
    );
  }

  // Group features by category
  const groupedFlags = featureFlags.reduce((acc, flag) => {
    if (!acc[flag.category]) {
      acc[flag.category] = [];
    }
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  // Calculate statistics
  const totalFlags = featureFlags.length;
  const enabledFlags = featureFlags.filter(f => f.enabled).length;
  const rolloutFlags = featureFlags.filter(f => f.rolloutPercentage && f.rolloutPercentage < 100).length;

  return (
    <div>
      <Alert
        message="Feature Flags Control"
        description="Enable or disable features for all users. Changes take effect immediately. Features in rollout will be gradually enabled for users based on the rollout percentage."
        type="info"
        showIcon
        icon={<ExperimentOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">Total Features</Text>
              <Title level={3} style={{ margin: 0 }}>{totalFlags}</Title>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">Enabled</Text>
              <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                {enabledFlags}
              </Title>
              <Progress
                percent={Math.round((enabledFlags / totalFlags) * 100)}
                strokeColor="#52c41a"
                showInfo={false}
                size="small"
              />
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">In Rollout</Text>
              <Title level={3} style={{ margin: 0, color: '#faad14' }}>
                {rolloutFlags}
              </Title>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Feature Flags by Category */}
      {Object.entries(groupedFlags).map(([category, flags]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>
            <Space>
              {categoryIcons[category] || <ExperimentOutlined />}
              {category}
              <Badge count={flags.length} style={{ backgroundColor: getCategoryColor(category) }} />
            </Space>
          </Title>
          
          <Row gutter={[16, 16]}>
            {flags.map(flag => (
              <Col span={12} key={flag.id}>
                <Card
                  size="small"
                  style={{
                    backgroundColor: getFeatureCardColor(flag),
                    borderColor: flag.enabled ? '#b7eb8f' : '#d9d9d9',
                  }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Switch
                          checked={flag.enabled}
                          loading={toggling === flag.id}
                          onChange={() => handleToggle(flag.id)}
                        />
                        <Text strong style={{ fontSize: 16 }}>
                          {flag.name}
                        </Text>
                      </Space>
                      <Tag color={flag.enabled ? 'success' : 'default'}>
                        {flag.enabled ? 'ENABLED' : 'DISABLED'}
                      </Tag>
                    </Space>

                    <Text type="secondary">{flag.description}</Text>

                    <Space wrap>
                      <Tag color={getCategoryColor(flag.category)}>
                        {flag.category}
                      </Tag>
                      {flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100 && (
                        <Tooltip title="This feature is being gradually rolled out to users">
                          <Tag color="orange" icon={<InfoCircleOutlined />}>
                            {flag.rolloutPercentage}% rollout
                          </Tag>
                        </Tooltip>
                      )}
                      {flag.targetGroups && flag.targetGroups.length > 0 && (
                        <Tooltip title={`Targeted to: ${flag.targetGroups.join(', ')}`}>
                          <Tag color="blue" icon={<TeamOutlined />}>
                            Targeted
                          </Tag>
                        </Tooltip>
                      )}
                    </Space>

                    {flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100 && (
                      <Progress
                        percent={flag.rolloutPercentage}
                        size="small"
                        strokeColor="#faad14"
                        format={percent => `${percent}% of users`}
                      />
                    )}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}

      {featureFlags.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <ExperimentOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
            <Title level={4} type="secondary" style={{ marginTop: 16 }}>
              No Feature Flags Configured
            </Title>
            <Text type="secondary">
              Feature flags will appear here once they are configured in the system.
            </Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default FeatureFlagsTab;