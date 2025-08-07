import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Typography, Collapse } from 'antd';
import { ReloadOutlined, BugOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If custom fallback is provided, use it
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: 24 
        }}>
          <Result
            status="error"
            icon={<BugOutlined style={{ fontSize: 72 }} />}
            title="Oops! Something went wrong"
            subTitle={
              <div>
                <Paragraph>
                  The application encountered an unexpected error. 
                  {errorCount > 2 && (
                    <Text type="warning">
                      {' '}This error has occurred {errorCount} times.
                    </Text>
                  )}
                </Paragraph>
                <Paragraph type="secondary" style={{ fontSize: 14 }}>
                  {error.message || 'An unexpected error occurred'}
                </Paragraph>
              </div>
            }
            extra={[
              <Button 
                key="retry" 
                type="primary" 
                icon={<ReloadOutlined />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>,
              <Button 
                key="reload" 
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === 'development' && errorInfo && (
              <Collapse ghost style={{ marginTop: 24, textAlign: 'left' }}>
                <Panel 
                  header="Error Details (Development Only)" 
                  key="1"
                  style={{ backgroundColor: '#fff2f0', borderRadius: 8 }}
                >
                  <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    <Text strong>Error Stack:</Text>
                    <pre style={{ 
                      overflow: 'auto', 
                      padding: 12, 
                      backgroundColor: '#f5f5f5',
                      borderRadius: 4,
                      marginTop: 8 
                    }}>
                      {error.stack}
                    </pre>
                    
                    <Text strong>Component Stack:</Text>
                    <pre style={{ 
                      overflow: 'auto', 
                      padding: 12, 
                      backgroundColor: '#f5f5f5',
                      borderRadius: 4,
                      marginTop: 8 
                    }}>
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                </Panel>
              </Collapse>
            )}
          </Result>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;