import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Drawer,
  Form,
  message,
  Popconfirm,
  Tooltip,
  Card,
  Row,
  Col,
  Divider,
  Tree,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DatabaseOutlined,
  CalculatorOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';

const { Option } = Select;
const { Search } = Input;

interface Field {
  id: string;
  name: string;
  displayName: string;
  description: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  fieldType: 'dimension' | 'measure' | 'calculated';
  category: string;
  format?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none';
  formula?: string;
  sourceTables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
}

interface FieldRelationship {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  joinCondition?: string;
}

const FieldManagement: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [relationships, setRelationships] = useState<FieldRelationship[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [relationshipModalVisible, setRelationshipModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const [relationshipForm] = Form.useForm();

  // Mock data
  useEffect(() => {
    const mockFields: Field[] = [
      {
        id: 'f1',
        name: 'fund_name',
        displayName: 'Fund Name',
        description: 'The name of the investment fund',
        dataType: 'string',
        fieldType: 'dimension',
        category: 'Fund Information',
        sourceTables: ['funds'],
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        createdBy: 'admin',
        tags: ['core', 'required'],
      },
      {
        id: 'f2',
        name: 'total_assets',
        displayName: 'Total Assets',
        description: 'Total assets under management',
        dataType: 'number',
        fieldType: 'measure',
        category: 'Fund Information',
        format: 'currency',
        aggregation: 'sum',
        sourceTables: ['fund_metrics'],
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        createdBy: 'admin',
        tags: ['financial'],
      },
      {
        id: 'f3',
        name: 'ytd_return',
        displayName: 'YTD Return',
        description: 'Year-to-date return percentage',
        dataType: 'number',
        fieldType: 'calculated',
        category: 'Performance',
        format: 'percentage',
        formula: '(current_value - year_start_value) / year_start_value * 100',
        sourceTables: ['fund_performance'],
        isActive: true,
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02',
        createdBy: 'admin',
        tags: ['performance', 'calculated'],
      },
    ];
    setFields(mockFields);

    const mockRelationships: FieldRelationship[] = [
      {
        id: 'r1',
        sourceFieldId: 'f1',
        targetFieldId: 'f2',
        relationshipType: 'one-to-many',
        joinCondition: 'funds.id = fund_metrics.fund_id',
      },
    ];
    setRelationships(mockRelationships);
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setSelectedField(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: Field) => {
    setSelectedField(record);
    form.setFieldsValue(record);
    setDrawerVisible(true);
  };

  const handleDelete = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    message.success('Field deleted successfully');
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
    setSelectedField(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (selectedField) {
        // Update existing field
        setFields(fields.map(f => 
          f.id === selectedField.id 
            ? { ...f, ...values, updatedAt: new Date().toISOString() }
            : f
        ));
        message.success('Field updated successfully');
      } else {
        // Add new field
        const newField: Field = {
          ...values,
          id: `f${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current_user',
        };
        setFields([...fields, newField]);
        message.success('Field added successfully');
      }
      
      handleDrawerClose();
    } catch (error) {
      message.error('Please fill in all required fields');
    }
  };

  const columns: ColumnsType<Field> = [
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.fieldType === 'calculated' && (
            <Tooltip title="Calculated field">
              <CalculatorOutlined style={{ color: '#1890ff' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Field Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <code>{text}</code>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      filters: Array.from(new Set(fields.map(f => f.category))).map(cat => ({
        text: cat,
        value: cat,
      })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Type',
      dataIndex: 'fieldType',
      key: 'fieldType',
      render: (type) => {
        const color = type === 'dimension' ? 'blue' : type === 'measure' ? 'green' : 'orange';
        return <Tag color={color}>{type.toUpperCase()}</Tag>;
      },
      filters: [
        { text: 'Dimension', value: 'dimension' },
        { text: 'Measure', value: 'measure' },
        { text: 'Calculated', value: 'calculated' },
      ],
      onFilter: (value, record) => record.fieldType === value,
    },
    {
      title: 'Data Type',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <>
          {tags.map(tag => (
            <Tag key={tag} style={{ marginBottom: 4 }}>
              {tag}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="View Relationships">
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => {
                setSelectedField(record);
                setRelationshipModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Field"
            description="Are you sure you want to delete this field?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredFields = fields.filter(field => {
    const matchesSearch = field.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
                         field.name.toLowerCase().includes(searchText.toLowerCase()) ||
                         field.description.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = !filterCategory || field.category === filterCategory;
    const matchesType = !filterType || field.fieldType === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const fieldTreeData: DataNode[] = Array.from(new Set(fields.map(f => f.category))).map(category => ({
    title: category,
    key: category,
    icon: <FolderOutlined />,
    children: fields
      .filter(f => f.category === category)
      .map(field => ({
        title: field.displayName,
        key: field.id,
        icon: <FileOutlined />,
        isLeaf: true,
      })),
  }));

  return (
    <div>
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>Field Management</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            Add Field
          </Button>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="Search fields..."
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder="Filter by category"
              style={{ width: '100%' }}
              onChange={setFilterCategory}
              allowClear
            >
              {Array.from(new Set(fields.map(f => f.category))).map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Select
              placeholder="Filter by type"
              style={{ width: '100%' }}
              onChange={setFilterType}
              allowClear
            >
              <Option value="dimension">Dimension</Option>
              <Option value="measure">Measure</Option>
              <Option value="calculated">Calculated</Option>
            </Select>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Card size="small" title="Field Hierarchy">
              <Tree
                treeData={fieldTreeData}
                defaultExpandAll
                showIcon
                style={{ maxHeight: 400, overflow: 'auto' }}
              />
            </Card>
          </Col>
          <Col span={18}>
            <Table
              columns={columns}
              dataSource={filteredFields}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} fields`,
              }}
              scroll={{ x: 1200 }}
            />
          </Col>
        </Row>
      </Card>

      <Drawer
        title={selectedField ? 'Edit Field' : 'Add New Field'}
        placement="right"
        width={600}
        onClose={handleDrawerClose}
        open={drawerVisible}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={handleDrawerClose}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>
              {selectedField ? 'Update' : 'Create'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            isActive: true,
            dataType: 'string',
            fieldType: 'dimension',
            aggregation: 'none',
          }}
        >
          <Form.Item
            label="Display Name"
            name="displayName"
            rules={[{ required: true, message: 'Please enter display name' }]}
          >
            <Input placeholder="e.g., Fund Name" />
          </Form.Item>

          <Form.Item
            label="Field Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter field name' },
              { pattern: /^[a-z_][a-z0-9_]*$/, message: 'Use lowercase letters, numbers, and underscores' }
            ]}
          >
            <Input placeholder="e.g., fund_name" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input.TextArea rows={3} placeholder="Describe what this field represents" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Category"
                name="category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  <Option value="Fund Information">Fund Information</Option>
                  <Option value="Performance">Performance</Option>
                  <Option value="Pricing">Pricing</Option>
                  <Option value="Risk">Risk</Option>
                  <Option value="Custom">Custom</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Field Type"
                name="fieldType"
                rules={[{ required: true, message: 'Please select field type' }]}
              >
                <Select placeholder="Select type">
                  <Option value="dimension">Dimension</Option>
                  <Option value="measure">Measure</Option>
                  <Option value="calculated">Calculated</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Data Type"
                name="dataType"
                rules={[{ required: true, message: 'Please select data type' }]}
              >
                <Select placeholder="Select data type">
                  <Option value="string">String</Option>
                  <Option value="number">Number</Option>
                  <Option value="date">Date</Option>
                  <Option value="boolean">Boolean</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Format"
                name="format"
              >
                <Select placeholder="Select format" allowClear>
                  <Option value="currency">Currency</Option>
                  <Option value="percentage">Percentage</Option>
                  <Option value="number">Number</Option>
                  <Option value="date">Date</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.fieldType !== currentValues.fieldType
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('fieldType') === 'measure' ? (
                <Form.Item
                  label="Aggregation"
                  name="aggregation"
                >
                  <Select placeholder="Select aggregation">
                    <Option value="sum">Sum</Option>
                    <Option value="avg">Average</Option>
                    <Option value="count">Count</Option>
                    <Option value="min">Minimum</Option>
                    <Option value="max">Maximum</Option>
                    <Option value="none">None</Option>
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.fieldType !== currentValues.fieldType
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('fieldType') === 'calculated' ? (
                <Form.Item
                  label="Formula"
                  name="formula"
                  rules={[{ required: true, message: 'Please enter formula' }]}
                >
                  <Input.TextArea 
                    rows={3} 
                    placeholder="e.g., (current_value - previous_value) / previous_value * 100"
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            label="Source Tables"
            name="sourceTables"
          >
            <Select
              mode="tags"
              placeholder="Enter source table names"
            />
          </Form.Item>

          <Form.Item
            label="Tags"
            name="tags"
          >
            <Select
              mode="tags"
              placeholder="Add tags"
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="isActive"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title="Field Relationships"
        open={relationshipModalVisible}
        onCancel={() => {
          setRelationshipModalVisible(false);
          setSelectedField(null);
        }}
        footer={null}
        width={800}
      >
        {selectedField && (
          <div>
            <h3>Relationships for: {selectedField.displayName}</h3>
            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
              {relationships
                .filter(r => r.sourceFieldId === selectedField.id || r.targetFieldId === selectedField.id)
                .map(rel => {
                  const sourceField = fields.find(f => f.id === rel.sourceFieldId);
                  const targetField = fields.find(f => f.id === rel.targetFieldId);
                  return (
                    <Card key={rel.id} size="small">
                      <Space>
                        <Tag color="blue">{sourceField?.displayName}</Tag>
                        <span>→</span>
                        <Tag color="green">{targetField?.displayName}</Tag>
                        <Tag>{rel.relationshipType}</Tag>
                      </Space>
                      {rel.joinCondition && (
                        <div style={{ marginTop: 8 }}>
                          <code>{rel.joinCondition}</code>
                        </div>
                      )}
                    </Card>
                  );
                })}
            </Space>
            <Divider />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              block
              onClick={() => {
                relationshipForm.resetFields();
                relationshipForm.setFieldsValue({ sourceFieldId: selectedField.id });
              }}
            >
              Add Relationship
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FieldManagement;