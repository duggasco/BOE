import React, { useEffect, useState } from 'react';
import { Layout, Button, Space, Dropdown, message, Modal, Drawer } from 'antd';
import {
  SaveOutlined,
  PlayCircleOutlined,
  ExportOutlined,
  UndoOutlined,
  RedoOutlined,
  PlusOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import FieldSelector from '../../components/ReportBuilder/FieldSelector';
import ReportCanvas from '../../components/ReportBuilder/ReportCanvas';
import PropertiesPanel from '../../components/ReportBuilder/PropertiesPanel';
import ExportDialog from '../../components/ReportBuilder/ExportDialog';
import type { RootState, AppDispatch } from '../../store';
import {
  initializeReport,
  addSection,
  setDraggedField,
  addFieldToSection,
  saveReport,
  loadReport,
  undo,
  redo,
  createSectionWithField,
} from '../../store/slices/reportBuilderSlice';
import { executeQueryForSection } from '../../store/slices/querySlice';
import { openExportDialog, setAvailablePrompts } from '../../store/slices/exportSlice';
import type { Field, ReportSection } from '../../types';
import type { PromptValue } from '../../store/slices/exportSlice';
import styles from './ReportBuilder.module.scss';

const { Header, Sider, Content } = Layout;

const ReportBuilder: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [collapsed, setCollapsed] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [propertiesDrawerOpen, setPropertiesDrawerOpen] = useState(false);
  
  const { currentReport, selectedSectionId, isDirty, draggedField } = useSelector(
    (state: RootState) => state.reportBuilder
  );
  const queryResults = useSelector((state: RootState) => state.query.results);
  const queryLoading = useSelector((state: RootState) => state.query.loading);
  
  useEffect(() => {
    if (id) {
      // Load existing report
      const savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
      const report = savedReports.find((r: any) => r.id === id);
      if (report) {
        dispatch(loadReport(report));
      } else {
        message.error('Report not found');
        navigate('/reports');
      }
    } else {
      // Create new report
      dispatch(initializeReport({ name: 'New Report' }));
    }
  }, [id, dispatch, navigate]);
  
  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as any;
    
    // Check if we're dragging multiple fields
    if (dragData.isMultiple === true && dragData.multipleFields) {
      // For now, just set the first field as the dragged field for visual feedback
      // In a full implementation, we might want to show all dragged fields
      dispatch(setDraggedField(dragData.multipleFields[0]));
    } else {
      const field = dragData as Field;
      dispatch(setDraggedField(field));
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    dispatch(setDraggedField(null));
    
    if (!event.over || !event.active.data.current) return;
    
    const dragData = event.active.data.current as any;
    const dropTarget = event.over.data.current as any;
    
    // Check if we're dragging multiple fields
    const isMultiple = dragData.isMultiple === true;
    const fields = isMultiple ? dragData.multipleFields : [dragData as Field];
    
    // Handle dropping on the canvas (create new section)
    if (dropTarget.type === 'canvas' && (!currentReport?.sections || currentReport.sections.length === 0)) {
      // Create a new table section with the first field
      const firstField = fields[0];
      dispatch(createSectionWithField({
        field: firstField,
        sectionType: 'table',
      })).then((action) => {
        if (action.payload) {
          const sectionId = action.payload as string;
          
          // Add remaining fields if multiple
          if (fields.length > 1) {
            fields.slice(1).forEach(field => {
              const fieldTarget: 'dimensions' | 'measures' = 
                field.dataType === 'string' || field.aggregation === 'none' 
                  ? 'dimensions' 
                  : 'measures';
              
              dispatch(addFieldToSection({
                sectionId,
                field,
                target: fieldTarget,
              }));
            });
          }
          
          // Build query with all fields
          const dimensions = fields.filter(f => f.dataType === 'string' || f.aggregation === 'none');
          const measures = fields.filter(f => f.dataType !== 'string' && f.aggregation !== 'none');
          
          const query = {
            dimensions,
            measures,
            filters: [],
            sort: [],
            limit: 1000,
          };
          
          // Execute query for the new section
          dispatch(executeQueryForSection({
            sectionId,
            query,
          }));
        }
      });
    }
    // Handle dropping on an existing section
    else if (dropTarget.type === 'section' && dropTarget.sectionId) {
      const section = currentReport?.sections.find(s => s.id === dropTarget.sectionId);
      if (!section) return;
      
      // Get existing fields
      const existingDimensions = section.dataQuery?.dimensions || [];
      const existingMeasures = section.dataQuery?.measures || [];
      
      // Add all new fields, avoiding duplicates
      const newDimensions = [...existingDimensions];
      const newMeasures = [...existingMeasures];
      
      fields.forEach(field => {
        const fieldTarget: 'dimensions' | 'measures' = 
          field.dataType === 'string' || field.aggregation === 'none' 
            ? 'dimensions' 
            : 'measures';
        
        if (fieldTarget === 'dimensions') {
          if (!newDimensions.some(f => f.fieldId === field.fieldId)) {
            newDimensions.push(field);
            dispatch(addFieldToSection({
              sectionId: dropTarget.sectionId,
              field,
              target: 'dimensions',
            }));
          }
        } else {
          if (!newMeasures.some(f => f.fieldId === field.fieldId)) {
            newMeasures.push(field);
            dispatch(addFieldToSection({
              sectionId: dropTarget.sectionId,
              field,
              target: 'measures',
            }));
          }
        }
      });
      
      // Execute query with all fields
      const updatedQuery = {
        ...section.dataQuery,
        dimensions: newDimensions,
        measures: newMeasures,
      };
      
      dispatch(executeQueryForSection({
        sectionId: dropTarget.sectionId,
        query: updatedQuery,
      }));
    }
  };
  
  const handleSave = () => {
    if (!currentReport) return;
    
    dispatch(saveReport());
    message.success('Report saved successfully');
  };
  
  const handleRun = () => {
    if (!currentReport) return;
    
    // Execute all queries
    currentReport.sections.forEach(section => {
      if (section.dataQuery) {
        dispatch(executeQueryForSection({
          sectionId: section.id,
          query: section.dataQuery,
        }));
      }
    });
    
    message.info('Executing report queries...');
  };
  
  const handleExport = () => {
    if (!currentReport) {
      message.warning('No report to export');
      return;
    }
    
    // Set up mock prompts for demo (in real app, these would come from report definition)
    const mockPrompts: PromptValue[] = [
      {
        promptId: 'start_date',
        displayName: 'Start Date',
        type: 'static',
        value: '2024-01-01',
      },
      {
        promptId: 'end_date',
        displayName: 'End Date',
        type: 'static',
        value: '2024-12-31',
      },
      {
        promptId: 'fund_type',
        displayName: 'Fund Type',
        type: 'static',
        value: 'All',
      },
    ];
    
    dispatch(setAvailablePrompts(mockPrompts));
    dispatch(openExportDialog({
      reportId: currentReport.id,
      reportName: currentReport.name,
    }));
  };
  
  const handleAddSection = (type: ReportSection['type']) => {
    dispatch(addSection({
      type,
      layout: {
        x: 0,
        y: 0,
        w: type === 'table' ? 12 : 6,
        h: type === 'table' ? 8 : 6,
      },
    }));
  };
  
  const addSectionMenu = {
    items: [
      { key: 'table', label: 'Table', onClick: () => handleAddSection('table') },
      { key: 'chart', label: 'Chart', onClick: () => handleAddSection('chart') },
      { key: 'text', label: 'Text', onClick: () => handleAddSection('text') },
      { key: 'container', label: 'Container', onClick: () => handleAddSection('container') },
    ],
  };
  
  
  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Layout className={styles.reportBuilder}>
        <Header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2>{currentReport?.name || 'New Report'}</h2>
            {isDirty && <span className={styles.unsaved}>*</span>}
          </div>
          
          <Space>
            <Button
              icon={<UndoOutlined />}
              onClick={() => dispatch(undo())}
              title="Undo"
            />
            <Button
              icon={<RedoOutlined />}
              onClick={() => dispatch(redo())}
              title="Redo"
            />
            
            <Dropdown menu={addSectionMenu}>
              <Button icon={<PlusOutlined />}>
                Add Section
              </Button>
            </Dropdown>
            
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              loading={Object.values(queryLoading).some(l => l)}
            >
              Run
            </Button>
            
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              Save
            </Button>
            
            <Button 
              icon={<ExportOutlined />}
              onClick={handleExport}
            >
              Export
            </Button>
            
            <Button
              icon={<SettingOutlined />}
              onClick={() => setPropertiesDrawerOpen(!propertiesDrawerOpen)}
              type={propertiesDrawerOpen ? 'primary' : 'default'}
              title="Properties Panel"
            >
              Properties
            </Button>
          </Space>
        </Header>
        
        <Layout>
          <Sider
            width={280}
            className={styles.leftPanel}
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            trigger={null}
          >
            <FieldSelector />
          </Sider>
          
          <Content className={styles.canvas} style={{ marginRight: 0 }}>
            <ReportCanvas
              sections={currentReport?.sections || []}
              queryResults={queryResults}
            />
          </Content>
        </Layout>
      </Layout>
      
      <ExportDialog />
      
      <Drawer
        title="Properties"
        placement="right"
        width={400}
        onClose={() => setPropertiesDrawerOpen(false)}
        open={propertiesDrawerOpen}
        styles={{
          body: {
            padding: 0,
          }
        }}
      >
        <PropertiesPanel
          selectedSectionId={selectedSectionId}
          sections={currentReport?.sections || []}
        />
      </Drawer>
    </DndContext>
  );
};

export default ReportBuilder;