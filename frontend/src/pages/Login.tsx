/**
 * Login Page Component
 * Handles user authentication
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Typography, 
  Alert, 
  Checkbox,
  Space,
  Divider,
  message 
} from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  LoginOutlined,
  BarChartOutlined 
} from '@ant-design/icons';
import type { AppDispatch } from '../store';
import { 
  login, 
  clearError, 
  selectIsAuthenticated, 
  selectIsLoading, 
  selectError,
  selectSessionExpired,
  selectLoginRedirect,
  setSessionExpired
} from '../store/slices/authSlice';
import './Login.css';

const { Title, Text, Link } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
  remember: boolean;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();

  // Redux state
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const sessionExpired = useSelector(selectSessionExpired);
  const loginRedirect = useSelector(selectLoginRedirect);

  // Local state
  const [showDemoCredentials, setShowDemoCredentials] = useState(true);

  // Get the redirect path from location state or use default
  const from = location.state?.from?.pathname || loginRedirect || '/reports';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Show session expired message
  useEffect(() => {
    if (sessionExpired) {
      message.warning('Your session has expired. Please log in again.');
      dispatch(setSessionExpired(false));
    }
  }, [sessionExpired, dispatch]);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      // Clear any existing errors
      dispatch(clearError());
      
      // Attempt login
      const result = await dispatch(login({
        username: values.username,
        password: values.password
      })).unwrap();
      
      // Success message
      message.success(`Welcome back, ${result.full_name || values.username}!`);
      
      // Navigate to the intended page
      navigate(from, { replace: true });
    } catch (err) {
      // Error is handled by Redux
      console.error('Login failed:', err);
    }
  };

  const fillDemoCredentials = (role: 'admin' | 'creator' | 'viewer') => {
    const credentials = {
      admin: { username: 'admin@boe-system.local', password: 'admin123' },
      creator: { username: 'creator@boe-system.local', password: 'creator123' },
      viewer: { username: 'viewer@boe-system.local', password: 'viewer123' }
    };
    
    form.setFieldsValue(credentials[role]);
    message.info(`Demo ${role} credentials filled`);
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-background-pattern" />
      </div>
      
      <Card className="login-card">
        <div className="login-header">
          <BarChartOutlined className="login-logo" />
          <Title level={2} className="login-title">
            BOE Replacement System
          </Title>
          <Text type="secondary">Sign in to access your reports and dashboards</Text>
        </div>

        {error && (
          <Alert
            message="Login Failed"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => dispatch(clearError())}
            style={{ marginBottom: 16 }}
          />
        )}

        {showDemoCredentials && (
          <Alert
            message="Demo Accounts Available"
            description={
              <Space direction="vertical" size="small">
                <Text>Try one of these demo accounts:</Text>
                <Space wrap>
                  <Button 
                    size="small" 
                    onClick={() => fillDemoCredentials('admin')}
                  >
                    Admin User
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => fillDemoCredentials('creator')}
                  >
                    Report Creator
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => fillDemoCredentials('viewer')}
                  >
                    Report Viewer
                  </Button>
                </Space>
              </Space>
            }
            type="info"
            closable
            onClose={() => setShowDemoCredentials(false)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          initialValues={{ remember: true }}
        >
          <Form.Item
            name="username"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your email"
              autoComplete="username"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Remember me</Checkbox>
            </Form.Item>
            <Link style={{ float: 'right' }} onClick={() => message.info('Password reset not implemented in demo')}>
              Forgot password?
            </Link>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isLoading}
              icon={<LoginOutlined />}
            >
              Sign In
            </Button>
          </Form.Item>

          <Divider>Or</Divider>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                onClick={() => message.info('SSO not implemented in demo')}
              >
                Sign in with SSO
              </Button>
              
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Text type="secondary">
                  Don't have an account?{' '}
                  <Link onClick={() => message.info('Registration not enabled in demo')}>
                    Request Access
                  </Link>
                </Text>
              </div>
            </Space>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <Text type="secondary" style={{ fontSize: 12 }}>
            © 2025 BOE Replacement System. All rights reserved.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;