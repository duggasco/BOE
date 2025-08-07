import React, { useState } from 'react';
import { Button, Space, Card, Alert } from 'antd';
import { BugOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';

// Component that throws an error during render
const RenderErrorComponent: React.FC = () => {
  throw new Error('Render error: Component failed to render');
  return <div>This will never render</div>;
};

// Component that throws an error in useEffect
const EffectErrorComponent: React.FC = () => {
  React.useEffect(() => {
    throw new Error('Effect error: useEffect failed');
  }, []);
  return <div>Effect component rendered</div>;
};

// Component that throws an error on user interaction
const InteractionErrorComponent: React.FC = () => {
  const handleClick = () => {
    throw new Error('Interaction error: Button click failed');
  };
  
  return (
    <Button danger onClick={handleClick}>
      Click to trigger error
    </Button>
  );
};

// Component that throws async error
const AsyncErrorComponent: React.FC = () => {
  const [loading, setLoading] = useState(false);
  
  const handleAsyncError = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error('Async error: Promise rejected');
  };
  
  return (
    <Button loading={loading} onClick={handleAsyncError}>
      Trigger async error
    </Button>
  );
};

// Main test component
const ErrorTestComponent: React.FC = () => {
  const [errorType, setErrorType] = useState<string | null>(null);
  const [showComponent, setShowComponent] = useState(false);
  
  const resetTest = () => {
    setErrorType(null);
    setShowComponent(false);
  };
  
  const triggerError = (type: string) => {
    setErrorType(type);
    setShowComponent(true);
  };
  
  return (
    <Card
      title={
        <Space>
          <BugOutlined />
          <span>Error Boundary Test Suite</span>
        </Space>
      }
      style={{ maxWidth: 800, margin: '20px auto' }}
    >
      <Alert
        message="Test Error Boundaries"
        description="Use these buttons to test different error scenarios and verify the error boundary catches them correctly."
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 20 }}
      />
      
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ marginBottom: 20 }}>
          <Space wrap>
            <Button 
              type="primary" 
              danger 
              onClick={() => triggerError('render')}
              icon={<ExclamationCircleOutlined />}
            >
              Trigger Render Error
            </Button>
            
            <Button 
              type="primary" 
              danger 
              onClick={() => triggerError('effect')}
              icon={<ExclamationCircleOutlined />}
            >
              Trigger Effect Error
            </Button>
            
            <Button 
              type="primary" 
              danger 
              onClick={() => triggerError('interaction')}
              icon={<ExclamationCircleOutlined />}
            >
              Show Interaction Error Component
            </Button>
            
            <Button 
              type="primary" 
              danger 
              onClick={() => triggerError('async')}
              icon={<ExclamationCircleOutlined />}
            >
              Show Async Error Component
            </Button>
            
            <Button onClick={resetTest}>
              Reset Test
            </Button>
          </Space>
        </div>
        
        {showComponent && (
          <Card 
            type="inner" 
            title={`Testing: ${errorType} error`}
            style={{ backgroundColor: '#fff2f0' }}
          >
            {errorType === 'render' && <RenderErrorComponent />}
            {errorType === 'effect' && <EffectErrorComponent />}
            {errorType === 'interaction' && <InteractionErrorComponent />}
            {errorType === 'async' && <AsyncErrorComponent />}
          </Card>
        )}
        
        <Alert
          message="Expected Behavior"
          description={
            <ul style={{ marginBottom: 0 }}>
              <li>Render Error: Should immediately show error boundary</li>
              <li>Effect Error: Should show error boundary after mount</li>
              <li>Interaction Error: Shows component, error on button click</li>
              <li>Async Error: Shows component, may not be caught by boundary</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );
};

export default ErrorTestComponent;