import React, { useState, useEffect, useCallback } from 'react';
import { Tree, Input, Card, Checkbox, Button, Space, Spin, Alert, message } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
  SearchOutlined, 
  DatabaseOutlined, 
  LineChartOutlined, 
  DollarOutlined, 
  DragOutlined,
  FolderOutlined,
  FieldNumberOutlined,
  FontSizeOutlined,
  CalendarOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import type { Field as FrontendField } from '../../types';
import type { DataNode } from 'antd/es/tree';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { fieldService, type Field as BackendField, type FieldHierarchy } from '../../services/api/fieldService';

const { Search } = Input;

// Icon mapping for different field types
const getFieldIcon = (field: BackendField) => {
  if (field.semantic_type === 'currency') return <DollarOutlined />;
  if (field.semantic_type === 'percentage') return <LineChartOutlined />;
  if (field.data_type === 'number') return <FieldNumberOutlined />;
  if (field.data_type === 'date' || field.data_type === 'datetime') return <CalendarOutlined />;
  if (field.data_type === 'boolean') return <CheckCircleOutlined />;
  return <FontSizeOutlined />;
};

// Convert backend field to frontend format
const convertToFrontendField = (field: BackendField): FrontendField => ({
  fieldId: field.id,
  displayName: field.display_name,
  dataType: field.data_type as any,
  aggregation: field.aggregation || 'none',
  semanticType: field.semantic_type as any,
  unit: field.unit,
  format: field.format ? {
    type: field.semantic_type === 'currency' ? 'currency' : 
          field.semantic_type === 'percentage' ? 'percentage' : 'number',
    decimals: field.data_type === 'number' ? 2 : 0,
    prefix: field.semantic_type === 'currency' ? '$' : undefined,
    suffix: field.semantic_type === 'percentage' ? '%' : undefined,
    thousandsSeparator: field.semantic_type === 'currency'
  } : undefined
});

// Draggable field component with checkbox support
const DraggableField: React.FC<{ 
  field: BackendField; 
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: (fieldId: string, checked: boolean) => void;
  isDraggingMultiple?: boolean;
}> = ({ field, children, isSelected, onSelect, isDraggingMultiple }) => {
  const frontendField = convertToFrontendField(field);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
    data: frontendField,
  });

  const handleCheckboxChange = (e: CheckboxChangeEvent) => {
    e.stopPropagation();
    onSelect(field.id, e.target.checked);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
    backgroundColor: isDragging ? '#e6f7ff' : isSelected ? '#f0f8ff' : 'transparent',
    border: isSelected ? '1px solid #1890ff' : '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'move'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Checkbox 
        checked={isSelected} 
        onChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
      />
      <div 
        style={{ flex: 1, cursor: isDragging ? 'grabbing' : 'grab', display: 'flex', alignItems: 'center', gap: '4px' }}
        {...listeners} 
        {...attributes}
      >
        {getFieldIcon(field)}
        {children}
      </div>
      {isDraggingMultiple && (
        <DragOutlined style={{ color: '#999', fontSize: '12px' }} />
      )}
    </div>
  );
};

const FieldSelectorWithAPI: React.FC = () => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [isDraggingMultiple, setIsDraggingMultiple] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<BackendField[]>([]);
  const [fieldHierarchy, setFieldHierarchy] = useState<FieldHierarchy[]>([]);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [fieldMap, setFieldMap] = useState<Map<string, BackendField>>(new Map());

  // Load fields from backend
  const loadFields = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch field hierarchy
      const hierarchy = await fieldService.getFieldHierarchy();
      setFieldHierarchy(hierarchy);
      
      // Create field map for quick access
      const map = new Map<string, BackendField>();
      const allFields: BackendField[] = [];
      
      hierarchy.forEach(category => {
        category.fields.forEach(field => {
          map.set(field.id, field);
          allFields.push(field);
        });
      });
      
      setFieldMap(map);
      setFields(allFields);
      
      // Build tree data
      const tree = buildTreeData(hierarchy, selectedFields);
      setTreeData(tree);
      
      // Set initial expanded keys (first 3 categories)
      const initialExpanded = hierarchy.slice(0, 3).map(cat => cat.category);
      setExpandedKeys(initialExpanded);
      
    } catch (err: any) {
      console.error('Failed to load fields:', err);
      setError(err.message || 'Failed to load fields from server');
      message.error('Failed to load fields. Using mock data.');
      
      // Fall back to mock data if API fails
      setTreeData(getMockTreeData(selectedFields));
      setExpandedKeys(['fund', 'performance', 'pricing']);
    } finally {
      setLoading(false);
    }
  }, []);

  // Build tree data from field hierarchy
  const buildTreeData = (hierarchy: FieldHierarchy[], selected: Set<string>): DataNode[] => {
    return hierarchy.map(category => ({
      title: category.category,
      key: category.category,
      icon: <FolderOutlined />,
      children: category.fields
        .filter(field => {
          if (!searchValue) return true;
          return field.display_name.toLowerCase().includes(searchValue.toLowerCase()) ||
                 field.description?.toLowerCase().includes(searchValue.toLowerCase());
        })
        .map(field => ({
          title: (
            <DraggableField 
              field={field}
              isSelected={selected.has(field.id)}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selected.has(field.id)}
            >
              {field.display_name}
              {field.description && (
                <span style={{ color: '#999', fontSize: '11px', marginLeft: '4px' }}>
                  ({field.description})
                </span>
              )}
            </DraggableField>
          ),
          key: field.id,
          isLeaf: true
        }))
    })).filter(category => category.children && category.children.length > 0);
  };

  // Get mock tree data as fallback
  const getMockTreeData = (selected: Set<string>): DataNode[] => {
    // Return mock data structure similar to original
    const mockFields = {
      fundName: { id: 'fundName', display_name: 'Fund Name', data_type: 'string' as any, field_type: 'dimension' as any },
      fundCode: { id: 'fundCode', display_name: 'Fund Code', data_type: 'string' as any, field_type: 'dimension' as any },
      totalAssets: { id: 'totalAssets', display_name: 'Total Assets', data_type: 'number' as any, field_type: 'measure' as any, semantic_type: 'currency' as any },
      return1m: { id: 'return1m', display_name: '1 Month Return', data_type: 'number' as any, field_type: 'measure' as any, semantic_type: 'percentage' as any },
    };

    return [
      {
        title: 'Fund Information',
        key: 'fund',
        icon: <DatabaseOutlined />,
        children: Object.values(mockFields).slice(0, 2).map(field => ({
          title: (
            <DraggableField 
              field={field as BackendField}
              isSelected={selected.has(field.id)}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selected.has(field.id)}
            >
              {field.display_name}
            </DraggableField>
          ),
          key: field.id,
          isLeaf: true
        }))
      },
      {
        title: 'Performance',
        key: 'performance',
        icon: <LineChartOutlined />,
        children: Object.values(mockFields).slice(2).map(field => ({
          title: (
            <DraggableField 
              field={field as BackendField}
              isSelected={selected.has(field.id)}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selected.has(field.id)}
            >
              {field.display_name}
            </DraggableField>
          ),
          key: field.id,
          isLeaf: true
        }))
      }
    ];
  };

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // Update tree data when search or selection changes
  useEffect(() => {
    if (fieldHierarchy.length > 0) {
      const tree = buildTreeData(fieldHierarchy, selectedFields);
      setTreeData(tree);
    }
  }, [searchValue, selectedFields, fieldHierarchy]);

  const handleFieldSelect = (fieldId: string, checked: boolean) => {
    const newSelected = new Set(selectedFields);
    if (checked) {
      newSelected.add(fieldId);
    } else {
      newSelected.delete(fieldId);
    }
    setSelectedFields(newSelected);
  };

  const handleSelectAll = () => {
    const allFieldIds = fields.map(f => f.id);
    setSelectedFields(new Set(allFieldIds));
  };

  const handleClearSelection = () => {
    setSelectedFields(new Set());
  };

  // Create a multi-field draggable wrapper
  const MultiFieldDraggable: React.FC = () => {
    const selectedFieldsArray = Array.from(selectedFields)
      .map(id => fieldMap.get(id))
      .filter(Boolean)
      .map(field => convertToFrontendField(field!));
    
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: 'multi-field-drag',
      data: {
        multipleFields: selectedFieldsArray,
        isMultiple: true
      },
    });
    
    const style = {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.8 : 1,
      cursor: isDragging ? 'grabbing' : 'grab',
    };
    
    if (selectedFields.size <= 1) return null;
    
    return (
      <div 
        ref={setNodeRef}
        style={{
          ...style,
          marginBottom: 8, 
          padding: '8px', 
          background: '#e6f7ff', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px dashed #1890ff'
        }}
        {...listeners}
        {...attributes}
      >
        <DragOutlined />
        <span style={{ fontSize: '12px' }}>
          Drag {selectedFields.size} selected fields together
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {Array.from(selectedFields).slice(0, 3).map(fieldId => {
            const field = fieldMap.get(fieldId);
            return field ? (
              <span 
                key={fieldId}
                style={{ 
                  fontSize: '11px', 
                  padding: '2px 6px', 
                  background: '#fff', 
                  borderRadius: '2px',
                  border: '1px solid #d9d9d9'
                }}
              >
                {field.display_name}
              </span>
            ) : null;
          })}
          {selectedFields.size > 3 && (
            <span style={{ fontSize: '11px', color: '#666' }}>
              +{selectedFields.size - 3} more
            </span>
          )}
        </div>
      </div>
    );
  };

  const onSearch = (value: string) => {
    setSearchValue(value);
    // Expand all keys when searching
    if (value && fieldHierarchy.length > 0) {
      setExpandedKeys(fieldHierarchy.map(cat => cat.category));
    }
  };

  // Retry loading fields
  const handleRetry = () => {
    loadFields();
  };

  return (
    <Card 
      title="Fields" 
      size="small"
      extra={
        <Space size="small">
          {selectedFields.size > 0 && (
            <>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {selectedFields.size} selected
              </span>
              <Button 
                size="small" 
                type="link" 
                onClick={handleClearSelection}
                style={{ padding: 0, height: 'auto' }}
              >
                Clear
              </Button>
              {fields.length > 0 && selectedFields.size < fields.length && (
                <Button 
                  size="small" 
                  type="link" 
                  onClick={handleSelectAll}
                  style={{ padding: 0, height: 'auto' }}
                >
                  Select All
                </Button>
              )}
            </>
          )}
          {!loading && (
            <Button 
              size="small" 
              type="link" 
              onClick={handleRetry}
              style={{ padding: 0, height: 'auto' }}
            >
              Refresh
            </Button>
          )}
        </Space>
      }
      styles={{ body: { padding: 8 } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin tip="Loading fields..." />
        </div>
      ) : error ? (
        <Alert
          message="Failed to load fields"
          description={error}
          type="warning"
          showIcon
          action={
            <Button size="small" type="primary" onClick={handleRetry}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <MultiFieldDraggable />
          <Search 
            placeholder="Search fields" 
            prefix={<SearchOutlined />}
            style={{ marginBottom: 8 }}
            onSearch={onSearch}
            onChange={(e) => onSearch(e.target.value)}
            allowClear
          />
          {treeData.length > 0 ? (
            <Tree
              treeData={treeData}
              showLine
              showIcon
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              blockNode
              selectable={false}
              style={{ maxHeight: '500px', overflowY: 'auto' }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              {searchValue ? 'No fields match your search' : 'No fields available'}
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default FieldSelectorWithAPI;