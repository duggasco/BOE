import React, { useEffect, useCallback } from 'react';
import { Modal, Tabs, Alert, message } from 'antd';
import {
  SettingOutlined,
  MailOutlined,
  ScheduleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectExport,
  selectExportValidation,
  closeExportDialog,
  setActiveTab,
  setValidationErrors,
  setExportStatus,
  exportSucceeded,
  setExportError
} from '../../../store/slices/exportSlice';
import { validateExportConfig } from '../../../utils/exportValidation';
import FormatPanel from './FormatPanel';
import DestinationPanel from './DestinationPanel';
import SchedulePanel from './SchedulePanel';
import PromptPanel from './PromptPanel';

const { TabPane } = Tabs;

console.log('ExportDialog component file loaded');

const ExportDialog: React.FC = () => {
  const dispatch = useDispatch();
  const exportState = useSelector(selectExport);
  const validation = useSelector(selectExportValidation);
  
  // Debug logging
  useEffect(() => {
    console.log('ExportDialog rendering, isOpen:', exportState.isOpen);
    console.log('Full export state:', exportState);
  }, [exportState]);
  
  // Validate on mount and when relevant state changes
  useEffect(() => {
    if (exportState.isOpen) {
      const validationResult = validateExportConfig(exportState);
      dispatch(setValidationErrors(validationResult.errors));
    }
  }, [
    dispatch,
    exportState.isOpen,
    exportState.format,
    exportState.formatOptions,
    exportState.destination,
    exportState.emailConfig,
    exportState.sftpConfig,
    exportState.filesystemConfig,
    exportState.schedule,
    exportState.promptValues
  ]);
  
  const handleExport = useCallback(async () => {
    // Final validation
    const validationResult = validateExportConfig(exportState);
    
    if (!validationResult.isValid) {
      dispatch(setValidationErrors(validationResult.errors));
      message.error('Please fix validation errors before exporting');
      
      // Switch to the tab with the first error
      const firstError = validationResult.errors[0];
      if (firstError.field.startsWith('prompt_')) {
        dispatch(setActiveTab('prompts'));
      } else if (['recipients', 'cc', 'bcc', 'subject', 'attachmentName'].includes(firstError.field)) {
        dispatch(setActiveTab('destination'));
      } else if (['startDate', 'startTime', 'endDate', 'dayOfWeek', 'dayOfMonth'].includes(firstError.field)) {
        dispatch(setActiveTab('schedule'));
      } else {
        dispatch(setActiveTab('format'));
      }
      return;
    }
    
    try {
      dispatch(setExportStatus('exporting'));
      
      // Create export configuration
      const exportConfig = {
        reportId: exportState.reportId,
        reportName: exportState.reportName,
        format: exportState.format,
        formatOptions: exportState.formatOptions[exportState.format],
        commonOptions: {
          includeFilters: exportState.includeFilters,
          includeTimestamp: exportState.includeTimestamp,
          includeMetadata: exportState.includeMetadata
        },
        destination: exportState.destination,
        destinationConfig: getDestinationConfig(),
        schedule: exportState.schedule.active ? exportState.schedule : null,
        promptValues: exportState.promptValues
      };
      
      // In a real app, this would call an API
      // For now, we'll simulate success
      await simulateExport(exportConfig);
      
      dispatch(exportSucceeded({ exportId: `export-${Date.now()}` }));
      message.success(
        exportState.schedule.active 
          ? 'Export scheduled successfully' 
          : 'Export started successfully'
      );
      
      // Close dialog after short delay
      setTimeout(() => {
        dispatch(closeExportDialog());
      }, 1500);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      dispatch(setExportError(errorMessage));
      message.error(errorMessage);
    }
  }, [dispatch, exportState]);
  
  const getDestinationConfig = () => {
    switch (exportState.destination) {
      case 'email':
        return exportState.emailConfig;
      case 'sftp':
        return exportState.sftpConfig;
      case 'filesystem':
        return exportState.filesystemConfig;
      default:
        return null;
    }
  };
  
  const simulateExport = (config: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Simulate API call
      setTimeout(() => {
        // Random chance of failure for demo
        if (Math.random() > 0.9) {
          reject(new Error('Simulated export error'));
        } else {
          console.log('Export configuration:', config);
          resolve();
        }
      }, 1000);
    });
  };
  
  const handleCancel = () => {
    dispatch(closeExportDialog());
  };
  
  const getTabBadge = (tabKey: string) => {
    const errorsForTab = validation.errors.filter(error => {
      switch (tabKey) {
        case 'format':
          return ['sheetName', 'delimiter', 'encoding', 'orientation', 'pageSize'].includes(error.field);
        case 'destination':
          return ['recipients', 'cc', 'bcc', 'subject', 'attachmentName', 'connectionId', 'remotePath', 'path'].includes(error.field);
        case 'schedule':
          return ['startDate', 'startTime', 'endDate', 'dayOfWeek', 'dayOfMonth'].includes(error.field);
        case 'prompts':
          return error.field.startsWith('prompt_');
        default:
          return false;
      }
    });
    
    if (errorsForTab.length > 0) {
      return (
        <span style={{ color: '#ff4d4f', marginLeft: 4 }}>
          <ExclamationCircleOutlined /> ({errorsForTab.length})
        </span>
      );
    }
    return null;
  };
  
  return (
    <Modal
      title={`Export: ${exportState.reportName || 'Report'}`}
      open={exportState.isOpen}
      onCancel={handleCancel}
      onOk={handleExport}
      width={800}
      okText={
        exportState.schedule.active 
          ? 'Schedule Export' 
          : 'Export Now'
      }
      confirmLoading={exportState.status === 'exporting'}
      okButtonProps={{
        disabled: !validation.isValid || exportState.status === 'exporting'
      }}
    >
      {validation.errors.length > 0 && (
        <Alert
          message="Validation Errors"
          description={`Please fix ${validation.errors.length} error(s) before exporting`}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Tabs 
        activeKey={exportState.activeTab} 
        onChange={(key) => dispatch(setActiveTab(key as any))}
      >
        <TabPane 
          tab={
            <span>
              <SettingOutlined /> Format
              {getTabBadge('format')}
            </span>
          } 
          key="format"
        >
          <FormatPanel />
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <MailOutlined /> Destination
              {getTabBadge('destination')}
            </span>
          } 
          key="destination"
        >
          <DestinationPanel />
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <ScheduleOutlined /> Schedule
              {getTabBadge('schedule')}
            </span>
          } 
          key="schedule"
        >
          <SchedulePanel />
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <DatabaseOutlined /> Prompts
              {getTabBadge('prompts')}
            </span>
          } 
          key="prompts"
        >
          <PromptPanel />
        </TabPane>
      </Tabs>
      
      {exportState.status === 'succeeded' && (
        <Alert
          message="Export Successful"
          description={`Export ID: ${exportState.lastExportId}`}
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
      
      {exportState.error && (
        <Alert
          message="Export Error"
          description={exportState.error}
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
};

export default ExportDialog;