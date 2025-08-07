import React, { useState } from 'react';
import { Tree, Input, Card, Checkbox, Button, Space } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SearchOutlined, DatabaseOutlined, LineChartOutlined, DollarOutlined, DragOutlined } from '@ant-design/icons';
import type { Field } from '../../types';
import type { DataNode } from 'antd/es/tree';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

const { Search } = Input;

// Draggable field component with checkbox support
const DraggableField: React.FC<{ 
  field: Field; 
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: (fieldId: string, checked: boolean) => void;
  isDraggingMultiple?: boolean;
}> = ({ field, children, isSelected, onSelect, isDraggingMultiple }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.fieldId,
    data: field,
  });

  const handleCheckboxChange = (e: CheckboxChangeEvent) => {
    e.stopPropagation();
    onSelect(field.fieldId, e.target.checked);
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
    ':hover': {
      backgroundColor: '#f0f0f0',
    },
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Checkbox 
        checked={isSelected} 
        onChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
      />
      <div 
        style={{ flex: 1, cursor: isDragging ? 'grabbing' : 'grab' }}
        {...listeners} 
        {...attributes}
      >
        {children}
      </div>
      {isDraggingMultiple && (
        <DragOutlined style={{ color: '#999', fontSize: '12px' }} />
      )}
    </div>
  );
};

const FieldSelector: React.FC = () => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['fund', 'performance', 'pricing']);
  const [searchValue, setSearchValue] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [isDraggingMultiple, setIsDraggingMultiple] = useState(false);

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
    const allFieldIds = Object.keys(fieldDefinitions);
    setSelectedFields(new Set(allFieldIds));
  };

  const handleClearSelection = () => {
    setSelectedFields(new Set());
  };

  // Create a multi-field draggable wrapper
  const MultiFieldDraggable: React.FC = () => {
    const selectedFieldsArray = Array.from(selectedFields).map(id => fieldDefinitions[id]);
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
          {Array.from(selectedFields).slice(0, 3).map(fieldId => (
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
              {fieldDefinitions[fieldId].displayName}
            </span>
          ))}
          {selectedFields.size > 3 && (
            <span style={{ fontSize: '11px', color: '#666' }}>
              +{selectedFields.size - 3} more
            </span>
          )}
        </div>
      </div>
    );
  };

  // Define fields with proper metadata
  const fieldDefinitions: Record<string, Field> = {
    fundName: {
      fieldId: 'fundName',
      displayName: 'Fund Name',
      dataType: 'string',
      aggregation: 'none',
      semanticType: 'dimension',
    },
    fundCode: {
      fieldId: 'fundCode',
      displayName: 'Fund Code',
      dataType: 'string',
      aggregation: 'none',
      semanticType: 'identifier',
    },
    fundType: {
      fieldId: 'fundType',
      displayName: 'Fund Type',
      dataType: 'string',
      aggregation: 'none',
      semanticType: 'dimension',
    },
    manager: {
      fieldId: 'manager',
      displayName: 'Manager',
      dataType: 'string',
      aggregation: 'none',
      semanticType: 'dimension',
    },
    totalAssets: {
      fieldId: 'totalAssets',
      displayName: 'Total Assets',
      dataType: 'number',
      aggregation: 'sum',
      format: {
        type: 'currency',
        decimals: 0,
        prefix: '$',
        thousandsSeparator: true,
      },
      semanticType: 'currency',
      unit: 'USD',
    },
    return1m: {
      fieldId: 'return1m',
      displayName: '1 Month Return',
      dataType: 'number',
      aggregation: 'avg',
      format: {
        type: 'percentage',
        decimals: 2,
      },
      semanticType: 'percentage',
      unit: '%',
    },
    return3m: {
      fieldId: 'return3m',
      displayName: '3 Month Return',
      dataType: 'number',
      aggregation: 'avg',
      format: {
        type: 'percentage',
        decimals: 2,
      },
      semanticType: 'percentage',
      unit: '%',
    },
    return1y: {
      fieldId: 'return1y',
      displayName: '1 Year Return',
      dataType: 'number',
      aggregation: 'avg',
      format: {
        type: 'percentage',
        decimals: 2,
      },
      semanticType: 'percentage',
      unit: '%',
    },
    returnYtd: {
      fieldId: 'returnYtd',
      displayName: 'YTD Return',
      dataType: 'number',
      aggregation: 'avg',
      format: {
        type: 'percentage',
        decimals: 2,
      },
      semanticType: 'percentage',
      unit: '%',
    },
    currentNav: {
      fieldId: 'currentNav',
      displayName: 'NAV',
      dataType: 'number',
      aggregation: 'none',
      format: {
        type: 'currency',
        decimals: 4,
        prefix: '$',
      },
      semanticType: 'currency',
      unit: 'USD',
    },
    dayChangePercent: {
      fieldId: 'dayChangePercent',
      displayName: 'Day Change %',
      dataType: 'number',
      aggregation: 'none',
      format: {
        type: 'percentage',
        decimals: 2,
      },
      semanticType: 'percentage',
      unit: '%',
    },
  };

  // Tree data with icons
  const treeData: DataNode[] = [
    {
      title: 'Fund Information',
      key: 'fund',
      icon: <DatabaseOutlined />,
      children: [
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.fundName}
              isSelected={selectedFields.has('fundName')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('fundName')}
            >
              Fund Name
            </DraggableField>
          ), 
          key: 'fundName', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.fundCode}
              isSelected={selectedFields.has('fundCode')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('fundCode')}
            >
              Fund Code
            </DraggableField>
          ), 
          key: 'fundCode', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.fundType}
              isSelected={selectedFields.has('fundType')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('fundType')}
            >
              Fund Type
            </DraggableField>
          ), 
          key: 'fundType', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.manager}
              isSelected={selectedFields.has('manager')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('manager')}
            >
              Manager
            </DraggableField>
          ), 
          key: 'manager', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.totalAssets}
              isSelected={selectedFields.has('totalAssets')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('totalAssets')}
            >
              Total Assets
            </DraggableField>
          ), 
          key: 'totalAssets', 
          isLeaf: true 
        },
      ],
    },
    {
      title: 'Performance',
      key: 'performance',
      icon: <LineChartOutlined />,
      children: [
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.return1m}
              isSelected={selectedFields.has('return1m')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('return1m')}
            >
              1 Month Return
            </DraggableField>
          ), 
          key: 'return1m', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.return3m}
              isSelected={selectedFields.has('return3m')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('return3m')}
            >
              3 Month Return
            </DraggableField>
          ), 
          key: 'return3m', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.return1y}
              isSelected={selectedFields.has('return1y')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('return1y')}
            >
              1 Year Return
            </DraggableField>
          ), 
          key: 'return1y', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.returnYtd}
              isSelected={selectedFields.has('returnYtd')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('returnYtd')}
            >
              YTD Return
            </DraggableField>
          ), 
          key: 'returnYtd', 
          isLeaf: true 
        },
      ],
    },
    {
      title: 'Pricing',
      key: 'pricing',
      icon: <DollarOutlined />,
      children: [
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.currentNav}
              isSelected={selectedFields.has('currentNav')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('currentNav')}
            >
              NAV
            </DraggableField>
          ), 
          key: 'currentNav', 
          isLeaf: true 
        },
        { 
          title: (
            <DraggableField 
              field={fieldDefinitions.dayChangePercent}
              isSelected={selectedFields.has('dayChangePercent')}
              onSelect={handleFieldSelect}
              isDraggingMultiple={isDraggingMultiple && selectedFields.has('dayChangePercent')}
            >
              Day Change %
            </DraggableField>
          ), 
          key: 'dayChangePercent', 
          isLeaf: true 
        },
      ],
    },
  ];

  const onSearch = (value: string) => {
    setSearchValue(value);
    // Expand all keys when searching
    if (value) {
      setExpandedKeys(['fund', 'performance', 'pricing']);
    }
  };

  // Filter tree nodes based on search
  const filterTreeNode = (node: DataNode): boolean => {
    if (!searchValue) return true;
    const title = typeof node.title === 'string' ? node.title : '';
    return title.toLowerCase().includes(searchValue.toLowerCase());
  };

  return (
    <Card 
      title="Fields" 
      size="small"
      extra={
        selectedFields.size > 0 && (
          <Space size="small">
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
          </Space>
        )
      }
      styles={{ body: { padding: 8 } }}
    >
      <MultiFieldDraggable />
      <Search 
        placeholder="Search fields" 
        prefix={<SearchOutlined />}
        style={{ marginBottom: 8 }}
        onSearch={onSearch}
        onChange={(e) => onSearch(e.target.value)}
      />
      <Tree
        treeData={treeData}
        showLine
        showIcon
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        filterTreeNode={filterTreeNode}
        blockNode
        selectable={false}
      />
    </Card>
  );
};

export default FieldSelector;