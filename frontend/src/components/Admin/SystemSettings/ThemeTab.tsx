import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Row,
  Col,
  Space,
  Divider,
  Card,
  ColorPicker,
  Select,
  message,
  Spin,
  Alert,
  Typography,
  Popconfirm,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import {
  SaveOutlined,
  ReloadOutlined,
  BgColorsOutlined,
  FontSizeOutlined,
  BorderOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import type { ThemeSettings } from '../../../types/settings';
import { settingsApi } from '../../../services/settingsApi';
import { FONT_FAMILIES } from '../../../constants/settings';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ThemeTab: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<ThemeSettings | null>(null);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    setLoading(true);
    try {
      const settings = await settingsApi.getThemeSettings();
      form.setFieldsValue(settings);
      setPreviewTheme(settings);
      setHasChanges(false);
    } catch (error) {
      message.error('Failed to load theme settings');
      console.error('Error loading theme settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Sanitize custom CSS if provided
      if (values.customCss) {
        values.customCss = settingsApi.sanitizeCSS(values.customCss);
      }

      setSaving(true);
      await settingsApi.updateThemeSettings(values);
      message.success('Theme settings saved and applied successfully');
      setHasChanges(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(`Failed to save theme: ${error.message}`);
      } else {
        message.error('Failed to save theme settings');
      }
      console.error('Error saving theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadThemeSettings();
    message.info('Theme settings reset to last saved values');
  };

  const handleValuesChange = (_: any, allValues: ThemeSettings) => {
    setHasChanges(true);
    setPreviewTheme(allValues);
  };

  const handleColorChange = (field: string) => (color: Color) => {
    const hexColor = typeof color === 'string' ? color : color.toHexString();
    form.setFieldValue(field, hexColor);
    handleValuesChange(null, form.getFieldsValue());
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading theme settings..." />
      </div>
    );
  }

  return (
    <Row gutter={24}>
      <Col span={16}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleValuesChange}
          autoComplete="off"
        >
          <Card title="Color Scheme" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="primaryColor"
                  label="Primary Color"
                  rules={[{ required: true, message: 'Primary color is required' }]}
                >
                  <ColorPicker
                    showText
                    onChange={handleColorChange('primaryColor')}
                    presets={[
                      {
                        label: 'Recommended',
                        colors: [
                          '#1677ff',
                          '#5A54F9',
                          '#9E339F',
                          '#ED4192',
                          '#E0282E',
                          '#F4801A',
                          '#F2BD27',
                          '#00B96B',
                        ],
                      },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="secondaryColor"
                  label="Secondary Color"
                  rules={[{ required: true, message: 'Secondary color is required' }]}
                >
                  <ColorPicker
                    showText
                    onChange={handleColorChange('secondaryColor')}
                    presets={[
                      {
                        label: 'Recommended',
                        colors: [
                          '#52c41a',
                          '#13c2c2',
                          '#1677ff',
                          '#722ed1',
                          '#eb2f96',
                          '#fa541c',
                          '#faad14',
                          '#a0d911',
                        ],
                      },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="backgroundColor"
                  label="Background Color"
                  rules={[{ required: true, message: 'Background color is required' }]}
                >
                  <ColorPicker
                    showText
                    onChange={handleColorChange('backgroundColor')}
                    presets={[
                      {
                        label: 'Light Backgrounds',
                        colors: [
                          '#ffffff',
                          '#fafafa',
                          '#f5f5f5',
                          '#f0f2f5',
                          '#e6f4ff',
                          '#f6ffed',
                          '#fff7e6',
                          '#fff1f0',
                        ],
                      },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="textColor"
                  label="Text Color"
                  rules={[{ required: true, message: 'Text color is required' }]}
                >
                  <ColorPicker
                    showText
                    onChange={handleColorChange('textColor')}
                    presets={[
                      {
                        label: 'Text Colors',
                        colors: [
                          '#000000',
                          '#262626',
                          '#434343',
                          '#595959',
                          '#8c8c8c',
                          '#bfbfbf',
                          '#d9d9d9',
                          '#ffffff',
                        ],
                      },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="Typography & Layout" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="fontSize"
                  label="Base Font Size (px)"
                  rules={[
                    { required: true, message: 'Font size is required' },
                    {
                      type: 'number',
                      min: 10,
                      max: 20,
                      message: 'Must be between 10 and 20 pixels',
                    },
                  ]}
                >
                  <InputNumber
                    min={10}
                    max={20}
                    style={{ width: '100%' }}
                    addonAfter="px"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="borderRadius"
                  label="Border Radius (px)"
                  rules={[
                    { required: true, message: 'Border radius is required' },
                    {
                      type: 'number',
                      min: 0,
                      max: 20,
                      message: 'Must be between 0 and 20 pixels',
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    max={20}
                    style={{ width: '100%' }}
                    addonAfter="px"
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="fontFamily"
                  label="Font Family"
                  rules={[{ required: true, message: 'Font family is required' }]}
                >
                  <Select placeholder="Select font family">
                    {FONT_FAMILIES.map(font => (
                      <Option key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="Branding" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="logoUrl"
                  label="Logo URL"
                  rules={[
                    {
                      type: 'url',
                      message: 'Please enter a valid URL',
                    },
                  ]}
                >
                  <Input
                    prefix={<PictureOutlined />}
                    placeholder="https://example.com/logo.png"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="faviconUrl"
                  label="Favicon URL"
                  rules={[
                    {
                      type: 'url',
                      message: 'Please enter a valid URL',
                    },
                  ]}
                >
                  <Input
                    prefix={<PictureOutlined />}
                    placeholder="https://example.com/favicon.ico"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="Custom CSS" style={{ marginBottom: 16 }}>
            <Alert
              message="Security Warning"
              description="Custom CSS is sanitized to prevent XSS attacks. Dangerous properties and imports will be removed. Use with caution."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              name="customCss"
              label="Custom CSS Code"
              extra="Enter custom CSS to override default styles. This CSS will be applied globally."
            >
              <TextArea
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
                placeholder={`/* Example custom CSS */
.custom-class {
  color: #1677ff;
  font-weight: bold;
}

/* Override button styles */
.ant-btn-primary {
  background: linear-gradient(90deg, #1677ff, #5a54f9);
}`}
              />
            </Form.Item>
          </Card>

          <Divider />

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
            >
              Save & Apply Theme
            </Button>
            <Popconfirm
              title="Reset Theme"
              description="Are you sure you want to reset to the last saved theme?"
              onConfirm={handleReset}
              okText="Yes"
              cancelText="No"
            >
              <Button icon={<ReloadOutlined />} disabled={!hasChanges}>
                Reset
              </Button>
            </Popconfirm>
          </Space>

          {hasChanges && (
            <Alert
              message="You have unsaved theme changes"
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Form>
      </Col>

      <Col span={8}>
        <Card
          title={
            <Space>
              <BgColorsOutlined />
              <span>Live Preview</span>
            </Space>
          }
          style={{
            position: 'sticky',
            top: 20,
          }}
        >
          {previewTheme && (
            <div
              style={{
                padding: 16,
                backgroundColor: previewTheme.backgroundColor,
                borderRadius: previewTheme.borderRadius,
                minHeight: 400,
              }}
            >
              <div
                style={{
                  padding: 16,
                  backgroundColor: '#fff',
                  borderRadius: previewTheme.borderRadius,
                  marginBottom: 16,
                }}
              >
                <Title
                  level={4}
                  style={{
                    color: previewTheme.primaryColor,
                    fontFamily: previewTheme.fontFamily,
                    fontSize: previewTheme.fontSize + 4,
                    margin: 0,
                  }}
                >
                  Sample Header
                </Title>
              </div>

              <div
                style={{
                  padding: 16,
                  backgroundColor: '#fff',
                  borderRadius: previewTheme.borderRadius,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: previewTheme.textColor,
                    fontFamily: previewTheme.fontFamily,
                    fontSize: previewTheme.fontSize,
                  }}
                >
                  This is sample body text showing how your content will appear with the selected theme settings.
                </Text>
              </div>

              <Space direction="vertical" style={{ width: '100%' }}>
                <button
                  style={{
                    backgroundColor: previewTheme.primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: previewTheme.borderRadius,
                    padding: '8px 16px',
                    fontFamily: previewTheme.fontFamily,
                    fontSize: previewTheme.fontSize,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Primary Button
                </button>

                <button
                  style={{
                    backgroundColor: previewTheme.secondaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: previewTheme.borderRadius,
                    padding: '8px 16px',
                    fontFamily: previewTheme.fontFamily,
                    fontSize: previewTheme.fontSize,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Secondary Button
                </button>

                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#fff',
                    border: `2px solid ${previewTheme.primaryColor}`,
                    borderRadius: previewTheme.borderRadius,
                  }}
                >
                  <Text
                    style={{
                      color: previewTheme.primaryColor,
                      fontFamily: previewTheme.fontFamily,
                      fontSize: previewTheme.fontSize,
                    }}
                  >
                    Bordered element with primary color
                  </Text>
                </div>
              </Space>

              {previewTheme.logoUrl && (
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <img
                    src={previewTheme.logoUrl}
                    alt="Logo Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 60,
                      borderRadius: previewTheme.borderRadius,
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default ThemeTab;