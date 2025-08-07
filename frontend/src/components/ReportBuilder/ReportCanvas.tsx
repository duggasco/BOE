import React, { useMemo } from 'react';
import { Card, Empty, Table, Tag, Space } from 'antd';
import { useDroppable } from '@dnd-kit/core';
import GridLayout from 'react-grid-layout';
import { TableOutlined, BarChartOutlined, FileTextOutlined, FolderOutlined, CloseCircleOutlined, ContainerOutlined } from '@ant-design/icons';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { ReportSection, Field, ChartConfig } from '../../types';
import type { QueryResult } from '../../services/queryExecutor';
import { useDispatch } from 'react-redux';
import { setSelectedSection, updateSectionLayout, removeFieldFromSection, updateSection } from '../../store/slices/reportBuilderSlice';
import type { AppDispatch } from '../../store';
import ChartRenderer from './ChartRenderer';
import TextEditor from './TextEditor';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface ReportCanvasProps {
  sections: ReportSection[];
  queryResults: Record<string, QueryResult>;
}

// Individual section component that can receive drops
const SectionComponent: React.FC<{
  section: ReportSection;
  queryResult?: QueryResult;
}> = ({ section, queryResult }) => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Make each section a drop target for fields
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: {
      type: 'section',
      sectionId: section.id,
      acceptsFields: true,
    },
  });

  const handleClick = () => {
    dispatch(setSelectedSection(section.id));
  };

  const getSectionIcon = () => {
    switch (section.type) {
      case 'table': return <TableOutlined />;
      case 'chart': return <BarChartOutlined />;
      case 'text': return <FileTextOutlined />;
      case 'container': return <ContainerOutlined />;
      default: return null;
    }
  };

  const renderSectionContent = () => {
    const hasNoFields = section.dataQuery && section.dataQuery.dimensions.length === 0 && section.dataQuery.measures.length === 0;

    const handleRemoveField = (fieldId: string, target: 'dimensions' | 'measures') => {
      dispatch(removeFieldFromSection({ sectionId: section.id, fieldId, target }));
    };

    const renderFieldTags = () => (
      <div style={{ marginBottom: 8, padding: '4px 8px', background: '#fafafa', borderRadius: 4 }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '12px' }}>Fields:</p>
        <Space wrap>
          {section.dataQuery?.dimensions.map(field => (
            <Tag 
              key={field.fieldId} 
              color="blue"
              closable
              closeIcon={<CloseCircleOutlined />}
              onClose={() => handleRemoveField(field.fieldId, 'dimensions')}
            >
              {field.displayName}
            </Tag>
          ))}
          {section.dataQuery?.measures.map(field => (
            <Tag 
              key={field.fieldId} 
              color="green"
              closable
              closeIcon={<CloseCircleOutlined />}
              onClose={() => handleRemoveField(field.fieldId, 'measures')}
            >
              {field.displayName}
            </Tag>
          ))}
        </Space>
      </div>
    );

    if (hasNoFields || !queryResult || !queryResult.data || queryResult.data.length === 0) {
      return (
        <>
          {!hasNoFields && renderFieldTags()}
          <Empty 
            description={
              <Space direction="vertical">
                <span>{hasNoFields ? 'Drop fields here to display data' : 'No data to display'}</span>
                {hasNoFields && (
                  <span style={{ fontSize: '12px', color: '#999' }}>
                    Drag dimensions and measures from the field list
                  </span>
                )}
              </Space>
            }
          />
        </>
      );
    }

    // Render based on section type
    if (queryResult.data.length > 0) {
      if (section.type === 'table') {
        // Generate AG-Grid column definitions from the first data row
        const firstRow = queryResult.data[0];
        const columnDefs: ColDef[] = Object.keys(firstRow).map(key => {
          const field = [...(section.dataQuery?.dimensions || []), ...(section.dataQuery?.measures || [])]
            .find(f => f.fieldId === key);
          
          return {
            field: key,
            headerName: field?.displayName || key,
            sortable: true,
            filter: true,
            resizable: true,
            valueFormatter: (params: any) => {
              const value = params.value;
              if (field?.format?.type === 'currency' && typeof value === 'number') {
                return `$${value.toLocaleString('en-US', { minimumFractionDigits: field.format.decimals || 0 })}`;
              }
              if (field?.format?.type === 'percentage' && typeof value === 'number') {
                return `${value.toFixed(field.format.decimals || 2)}%`;
              }
              return value;
            },
          };
        });

        return (
          <>
            {renderFieldTags()}
            <div className="ag-theme-quartz" style={{ height: 'calc(100% - 40px)', width: '100%' }}>
              <AgGridReact
                rowData={queryResult.data}
                columnDefs={columnDefs}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                animateRows={true}
                pagination={true}
                paginationPageSize={10}
              />
            </div>
          </>
        );
      }
      
      if (section.type === 'chart') {
        const dimensionFields = section.dataQuery?.dimensions || [];
        const measureFields = section.dataQuery?.measures || [];
        const dimensions = dimensionFields.map(d => d.fieldId);
        const measures = measureFields.map(m => m.fieldId);
        
        // Default chart config if not specified
        const chartConfig: ChartConfig = section.chartConfig || {
          type: measures.length > 1 ? 'bar' : 'line',
          xAxis: dimensions[0],
          yAxis: measures,
          legend: true,
          showDataLabels: false,
        };
        
        const handleChartConfigChange = (config: Partial<ChartConfig>) => {
          dispatch(updateSection({
            id: section.id,
            updates: {
              chartConfig: { ...chartConfig, ...config },
            },
          }));
        };
        
        return (
          <>
            {renderFieldTags()}
            <ChartRenderer
              data={queryResult.data}
              config={chartConfig}
              dimensions={dimensions}
              measures={measures}
              dimensionFields={dimensionFields}
              measureFields={measureFields}
              height={300}
              editable={true}
              onConfigChange={handleChartConfigChange}
            />
          </>
        );
      }
    }
    
    // Text section rendering
    if (section.type === 'text') {
      const handleTextChange = (newContent: string) => {
        dispatch(updateSection({
          id: section.id,
          updates: {
            textContent: newContent,
          },
        }));
      };
      
      return (
        <TextEditor
          content={section.textContent || ''}
          onChange={handleTextChange}
          editable={true}
          style={{ height: '100%' }}
        />
      );
    }
    
    // Container section rendering
    if (section.type === 'container') {
      return (
        <div style={{ 
          padding: '12px',
          background: '#f9f9f9',
          borderRadius: '4px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#666',
            fontWeight: 500,
            marginBottom: '8px'
          }}>
            Container Section
          </div>
          {section.children && section.children.length > 0 ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* In Phase 3, we would recursively render child sections here */}
              <Empty 
                description="Nested sections will be rendered here"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <Empty 
              description={
                <span style={{ fontSize: '12px' }}>
                  Drop sections here to create nested layouts
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      );
    }

    // Default fallback for data sections
    if (queryResult) {
      return (
        <div>
          {renderFieldTags()}
          <p>Data loaded: {queryResult.data.length} rows</p>
          <p>Execution time: {queryResult.executionTime.toFixed(2)}ms</p>
        </div>
      );
    }
    
    // Default empty state
    return (
      <Empty 
        description="Configure this section"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  };

  return (
    <Card
      ref={setNodeRef}
      title={
        <Space>
          {getSectionIcon()}
          <span>{section.type.charAt(0).toUpperCase() + section.type.slice(1)} Section</span>
        </Space>
      }
      size="small"
      style={{
        height: '100%',
        border: isOver ? '2px dashed #1890ff' : undefined,
        backgroundColor: isOver ? '#f0f8ff' : undefined,
      }}
      onClick={handleClick}
      styles={{ 
        body: {
          height: 'calc(100% - 38px)', 
          overflow: 'auto',
          padding: '8px',
        }
      }}
    >
      {renderSectionContent()}
    </Card>
  );
};

const ReportCanvas: React.FC<ReportCanvasProps> = ({ sections, queryResults }) => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Only make the canvas a drop target when there are no sections
  const { setNodeRef, isOver } = useDroppable({
    id: 'report-canvas',
    data: {
      type: 'canvas',
      acceptsFields: true,
    },
    disabled: sections.length > 0, // Disable canvas drops when sections exist
  });

  if (sections.length === 0) {
    return (
      <div 
        ref={setNodeRef}
        style={{ 
          height: '100%', 
          padding: 16,
          backgroundColor: isOver ? '#f0f8ff' : '#f0f2f5',
          border: isOver ? '2px dashed #1890ff' : undefined,
        }}
      >
        <Card style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Empty 
            description={
              <Space direction="vertical" size="large">
                <span style={{ fontSize: '16px' }}>
                  Drag a field here to create your first report section
                </span>
                <span style={{ color: '#999' }}>
                  Or use the "Add Section" button in the toolbar
                </span>
              </Space>
            }
            style={{ padding: 40 }}
          />
        </Card>
      </div>
    );
  }

  const layout = sections.map(section => ({
    i: section.id,
    x: section.layout.x,
    y: section.layout.y,
    w: section.layout.w,
    h: section.layout.h,
    minW: section.layout.minW || 2,
    minH: section.layout.minH || 2,
  }));

  const handleLayoutChange = (newLayout: any[]) => {
    newLayout.forEach(item => {
      const section = sections.find(s => s.id === item.i);
      if (section) {
        dispatch(updateSectionLayout({
          sectionId: item.i,
          layout: {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        }));
      }
    });
  };

  return (
    <div 
      style={{ 
        background: '#f0f2f5', 
        padding: 16, 
        height: '100%', 
        overflow: 'auto',
      }}
    >
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={50}
        width={1200}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".ant-card-head"
        compactType="vertical"
        preventCollision={false}
      >
        {sections.map(section => (
          <div key={section.id}>
            <SectionComponent
              section={section}
              queryResult={queryResults[section.id]}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
};

export default ReportCanvas;