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
  Avatar,
  Badge,
  Checkbox,
  Tabs,
  Modal,
  Alert,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  LockOutlined,
  UnlockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import UserForm from './UserForm';
export type { User } from './UserForm';

const { Option } = Select;
const { Search } = Input;
const { TabPane } = Tabs;

interface Group {
  id: string;
  name: string;
  displayName: string;
  description: string;
  members: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  displayName: string;
  description: string;
  category: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [userDrawerVisible, setUserDrawerVisible] = useState(false);
  const [groupDrawerVisible, setGroupDrawerVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterRole, setFilterRole] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('users');
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();

  // Mock data
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: 'u1',
        username: 'john.doe',
        email: 'john.doe@company.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        phone: '+1 555-1234',
        department: 'Finance',
        jobTitle: 'Senior Analyst',
        status: 'active',
        roles: ['r2', 'r3'],  // analyst, report_viewer
        groups: ['g1', 'g3'],  // finance_team, report_creators
        createdAt: '2023-01-15',
        lastLogin: '2025-08-07T10:30:00',
        lastPasswordChange: '2024-12-01',
        mfaEnabled: true,
      },
      {
        id: 'u2',
        username: 'jane.smith',
        email: 'jane.smith@company.com',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        phone: '+1 555-5678',
        department: 'IT',
        jobTitle: 'System Administrator',
        status: 'active',
        roles: ['r1'],  // admin (developer role not defined)
        groups: ['g2'],  // it_team
        createdAt: '2022-06-20',
        lastLogin: '2025-08-07T09:15:00',
        lastPasswordChange: '2025-01-10',
        mfaEnabled: true,
      },
      {
        id: 'u3',
        username: 'bob.wilson',
        email: 'bob.wilson@company.com',
        firstName: 'Bob',
        lastName: 'Wilson',
        displayName: 'Bob Wilson',
        department: 'Operations',
        jobTitle: 'Manager',
        status: 'inactive',
        roles: ['r4', 'r3'],  // manager, report_viewer
        groups: [],  // operations_team not defined in mock
        createdAt: '2023-08-10',
        lastLogin: '2025-07-15T14:20:00',
        mfaEnabled: false,
      },
      {
        id: 'u4',
        username: 'alice.johnson',
        email: 'alice.johnson@company.com',
        firstName: 'Alice',
        lastName: 'Johnson',
        displayName: 'Alice Johnson',
        phone: '+1 555-9012',
        department: 'HR',
        jobTitle: 'HR Specialist',
        status: 'active',
        roles: ['r3'],  // report_viewer (hr_specialist not defined)
        groups: [],  // hr_team not defined in mock
        createdAt: '2024-02-01',
        lastLogin: '2025-08-07T11:45:00',
        lastPasswordChange: '2024-11-15',
        mfaEnabled: false,
      },
      {
        id: 'u5',
        username: 'test.user',
        email: 'test.user@company.com',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
        status: 'locked',
        roles: ['r3'],  // report_viewer (closest to viewer)
        groups: [],
        createdAt: '2025-01-01',
        mfaEnabled: false,
      },
    ];

    const mockGroups: Group[] = [
      {
        id: 'g1',
        name: 'finance_team',
        displayName: 'Finance Team',
        description: 'Finance department users with access to financial reports',
        members: ['u1'],
        permissions: ['view_financial_reports', 'create_reports', 'export_reports'],
        createdAt: '2023-01-01',
        updatedAt: '2024-06-15',
        createdBy: 'admin',
      },
      {
        id: 'g2',
        name: 'it_team',
        displayName: 'IT Team',
        description: 'IT administrators with system access',
        members: ['u2'],
        permissions: ['admin_all', 'manage_users', 'manage_system'],
        createdAt: '2022-01-01',
        updatedAt: '2024-12-01',
        createdBy: 'admin',
      },
      {
        id: 'g3',
        name: 'report_creators',
        displayName: 'Report Creators',
        description: 'Users who can create and modify reports',
        members: ['u1', 'u2'],
        permissions: ['create_reports', 'edit_reports', 'delete_reports', 'share_reports'],
        createdAt: '2023-03-15',
        updatedAt: '2024-09-20',
        createdBy: 'admin',
      },
    ];

    const mockRoles: Role[] = [
      {
        id: 'r1',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full system administration access',
        permissions: ['admin_all'],
        isSystem: true,
      },
      {
        id: 'r2',
        name: 'analyst',
        displayName: 'Business Analyst',
        description: 'Can create and analyze reports',
        permissions: ['create_reports', 'view_reports', 'export_reports', 'schedule_reports'],
        isSystem: false,
      },
      {
        id: 'r3',
        name: 'report_viewer',
        displayName: 'Report Viewer',
        description: 'Can view and export reports',
        permissions: ['view_reports', 'export_reports'],
        isSystem: false,
      },
      {
        id: 'r4',
        name: 'manager',
        displayName: 'Manager',
        description: 'Can manage team reports and schedules',
        permissions: ['view_reports', 'create_reports', 'schedule_reports', 'manage_team_reports'],
        isSystem: false,
      },
    ];

    const mockPermissions: Permission[] = [
      { id: 'p1', resource: 'reports', action: 'view', displayName: 'View Reports', description: 'View existing reports', category: 'Reports' },
      { id: 'p2', resource: 'reports', action: 'create', displayName: 'Create Reports', description: 'Create new reports', category: 'Reports' },
      { id: 'p3', resource: 'reports', action: 'edit', displayName: 'Edit Reports', description: 'Modify existing reports', category: 'Reports' },
      { id: 'p4', resource: 'reports', action: 'delete', displayName: 'Delete Reports', description: 'Delete reports', category: 'Reports' },
      { id: 'p5', resource: 'reports', action: 'export', displayName: 'Export Reports', description: 'Export reports to various formats', category: 'Reports' },
      { id: 'p6', resource: 'reports', action: 'schedule', displayName: 'Schedule Reports', description: 'Create and manage report schedules', category: 'Reports' },
      { id: 'p7', resource: 'users', action: 'manage', displayName: 'Manage Users', description: 'Create, edit, and delete users', category: 'Administration' },
      { id: 'p8', resource: 'system', action: 'configure', displayName: 'System Configuration', description: 'Configure system settings', category: 'Administration' },
      { id: 'p9', resource: 'fields', action: 'manage', displayName: 'Manage Fields', description: 'Manage data fields and metadata', category: 'Data' },
      { id: 'p10', resource: 'all', action: 'admin', displayName: 'Full Admin', description: 'Complete administrative access', category: 'Administration' },
    ];

    setUsers(mockUsers);
    setGroups(mockGroups);
    setRoles(mockRoles);
    setPermissions(mockPermissions);
  }, []);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchText || 
      user.username.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email.toLowerCase().includes(searchText.toLowerCase()) ||
      user.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStatus = !filterStatus || user.status === filterStatus;
    const matchesRole = !filterRole || user.roles.includes(filterRole);
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Filter groups
  const filteredGroups = groups.filter(group => {
    return !searchText || 
      group.name.toLowerCase().includes(searchText.toLowerCase()) ||
      group.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
      group.description.toLowerCase().includes(searchText.toLowerCase());
  });

  const handleAddUser = () => {
    setSelectedUser(null);
    form.resetFields();
    setUserDrawerVisible(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    form.setFieldsValue({
      ...user,
      lastLogin: user.lastLogin ? dayjs(user.lastLogin) : undefined,
      lastPasswordChange: user.lastPasswordChange ? dayjs(user.lastPasswordChange) : undefined,
    });
    setUserDrawerVisible(true);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
    message.success('User deleted successfully');
  };

  const handleSaveUser = () => {
    form.validateFields().then(values => {
      if (selectedUser) {
        // Update existing user
        setUsers(users.map(u => 
          u.id === selectedUser.id 
            ? { ...u, ...values, updatedAt: new Date().toISOString() }
            : u
        ));
        message.success('User updated successfully');
      } else {
        // Add new user
        const newUser: User = {
          ...values,
          id: `u${users.length + 1}`,
          createdAt: new Date().toISOString(),
          status: 'active',
          mfaEnabled: false,
          roles: values.roles || [],
          groups: values.groups || [],
        };
        setUsers([...users, newUser]);
        message.success('User created successfully');
      }
      setUserDrawerVisible(false);
      form.resetFields();
    });
  };

  const handleAddGroup = () => {
    setSelectedGroup(null);
    groupForm.resetFields();
    setGroupDrawerVisible(true);
  };

  const handleEditGroup = (group: Group) => {
    setSelectedGroup(group);
    groupForm.setFieldsValue(group);
    setGroupDrawerVisible(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
    message.success('Group deleted successfully');
  };

  const handleSaveGroup = () => {
    groupForm.validateFields().then(values => {
      if (selectedGroup) {
        // Update existing group
        setGroups(groups.map(g => 
          g.id === selectedGroup.id 
            ? { ...g, ...values, updatedAt: new Date().toISOString() }
            : g
        ));
        message.success('Group updated successfully');
      } else {
        // Add new group
        const newGroup: Group = {
          ...values,
          id: `g${groups.length + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current_user',
          members: values.members || [],
          permissions: values.permissions || [],
        };
        setGroups([...groups, newGroup]);
        message.success('Group created successfully');
      }
      setGroupDrawerVisible(false);
      groupForm.resetFields();
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'locked': return 'error';
      case 'suspended': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircleOutlined />;
      case 'inactive': return <CloseCircleOutlined />;
      case 'locked': return <LockOutlined />;
      case 'suspended': return <InfoCircleOutlined />;
      default: return null;
    }
  };

  const userColumns: ColumnsType<User> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.avatar} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.displayName}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{record.username}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => (
        <Space>
          <MailOutlined />
          <a href={`mailto:${email}`}>{email}</a>
        </Space>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept) => dept || '-',
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (roleIds: string[]) => (
        <Space wrap>
          {roleIds.map(roleId => {
            const role = roles.find(r => r.id === roleId);
            return (
              <Tag key={roleId} color="blue">
                {role?.displayName || roleId}
              </Tag>
            );
          })}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag icon={getStatusIcon(status)} color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'MFA',
      dataIndex: 'mfaEnabled',
      key: 'mfaEnabled',
      render: (enabled) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title="Reset Password">
            <Button
              type="text"
              icon={<KeyOutlined />}
              onClick={() => message.info('Password reset email sent')}
            />
          </Tooltip>
          <Popconfirm
            title="Delete User"
            description="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
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

  const groupColumns: ColumnsType<Group> = [
    {
      title: 'Group Name',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.displayName}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.name}</div>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Members',
      dataIndex: 'members',
      key: 'members',
      render: (members: string[]) => (
        <Badge count={members.length} style={{ backgroundColor: '#52c41a' }} />
      ),
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <Space wrap>
          {permissions.slice(0, 3).map(perm => (
            <Tag key={perm} color="purple">
              {perm}
            </Tag>
          ))}
          {permissions.length > 3 && (
            <Tag>+{permissions.length - 3} more</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditGroup(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Group"
            description="Are you sure you want to delete this group?"
            onConfirm={() => handleDeleteGroup(record.id)}
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

  const roleColumns: ColumnsType<Role> = [
    {
      title: 'Role',
      key: 'role',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.displayName}
            {record.isSystem && (
              <Tag color="orange" style={{ marginLeft: 8 }}>SYSTEM</Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.name}</div>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <Space wrap>
          {permissions.map(perm => (
            <Tag key={perm} color="cyan">
              {perm}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title={record.isSystem ? "System roles cannot be edited" : "Edit"}>
            <Button
              type="text"
              icon={<EditOutlined />}
              disabled={record.isSystem}
              onClick={() => message.info('Edit role functionality')}
            />
          </Tooltip>
          <Tooltip title={record.isSystem ? "System roles cannot be deleted" : "Delete"}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.isSystem}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Space>
              <Search
                placeholder="Search users, groups, or roles..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                style={{ width: 400 }}
                onSearch={setSearchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {activeTab === 'users' && (
                <>
                  <Select
                    placeholder="Filter by status"
                    style={{ width: 150 }}
                    allowClear
                    value={filterStatus}
                    onChange={setFilterStatus}
                  >
                    <Option value="active">Active</Option>
                    <Option value="inactive">Inactive</Option>
                    <Option value="locked">Locked</Option>
                    <Option value="suspended">Suspended</Option>
                  </Select>
                  <Select
                    placeholder="Filter by role"
                    style={{ width: 200 }}
                    allowClear
                    value={filterRole}
                    onChange={setFilterRole}
                  >
                    {roles.map(role => (
                      <Option key={role.id} value={role.name}>
                        {role.displayName}
                      </Option>
                    ))}
                  </Select>
                </>
              )}
            </Space>
          </Col>
          <Col>
            {activeTab === 'users' && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddUser}>
                Add User
              </Button>
            )}
            {activeTab === 'groups' && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddGroup}>
                Add Group
              </Button>
            )}
            {activeTab === 'roles' && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => message.info('Add role functionality')}>
                Add Role
              </Button>
            )}
          </Col>
        </Row>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={<span><UserOutlined /> Users ({users.length})</span>} key="users">
            <Table
              columns={userColumns}
              dataSource={filteredUsers}
              rowKey="id"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} users`,
              }}
            />
          </TabPane>

          <TabPane tab={<span><TeamOutlined /> Groups ({groups.length})</span>} key="groups">
            <Table
              columns={groupColumns}
              dataSource={filteredGroups}
              rowKey="id"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} groups`,
              }}
            />
          </TabPane>

          <TabPane tab={<span><SafetyOutlined /> Roles ({roles.length})</span>} key="roles">
            <Table
              columns={roleColumns}
              dataSource={roles}
              rowKey="id"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} roles`,
              }}
            />
          </TabPane>

          <TabPane tab={<span><LockOutlined /> Permissions Matrix</span>} key="permissions">
            <Alert
              message="Permission Matrix"
              description="Configure role-based permissions for different resources and actions"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<SafetyOutlined />}
              onClick={() => setPermissionModalVisible(true)}
            >
              Configure Permissions
            </Button>
          </TabPane>
        </Tabs>
      </Card>

      {/* User Drawer */}
      <Drawer
        title={selectedUser ? 'Edit User' : 'Add New User'}
        width={600}
        open={userDrawerVisible}
        onClose={() => setUserDrawerVisible(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setUserDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveUser}>
              {selectedUser ? 'Update' : 'Create'}
            </Button>
          </Space>
        }
      >
        <UserForm 
          form={form} 
          selectedUser={selectedUser} 
          roles={roles} 
          groups={groups} 
        />
      </Drawer>

      {/* Group Drawer */}
      <Drawer
        title={selectedGroup ? 'Edit Group' : 'Add New Group'}
        width={600}
        open={groupDrawerVisible}
        onClose={() => setGroupDrawerVisible(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setGroupDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveGroup}>
              {selectedGroup ? 'Update' : 'Create'}
            </Button>
          </Space>
        }
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="Group Name (Technical)"
            rules={[
              { required: true, message: 'Please enter group name' },
              { pattern: /^[a-z0-9_]+$/, message: 'Must be lowercase with underscores only' }
            ]}
          >
            <Input placeholder="finance_team" />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, message: 'Please enter display name' }]}
          >
            <Input placeholder="Finance Team" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input.TextArea rows={3} placeholder="Finance department users with access to financial reports" />
          </Form.Item>

          <Form.Item
            name="members"
            label="Members"
          >
            <Select mode="multiple" placeholder="Select users">
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.displayName} ({user.username})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="permissions"
            label="Permissions"
          >
            <Select mode="multiple" placeholder="Select permissions">
              {permissions.map(perm => (
                <Option key={perm.id} value={`${perm.resource}_${perm.action}`}>
                  {perm.displayName}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Permission Matrix Modal */}
      <Modal
        title="Permission Matrix Configuration"
        open={permissionModalVisible}
        onCancel={() => setPermissionModalVisible(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setPermissionModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="save" type="primary" onClick={() => {
            message.success('Permissions updated successfully');
            setPermissionModalVisible(false);
          }}>
            Save Changes
          </Button>,
        ]}
      >
        <Alert
          message="Configure role permissions"
          description="Check the boxes to grant permissions to each role"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Table
          dataSource={permissions}
          rowKey="id"
          pagination={false}
          scroll={{ y: 400 }}
        >
          <Table.Column title="Permission" dataIndex="displayName" key="displayName" fixed="left" width={200} />
          <Table.Column title="Category" dataIndex="category" key="category" width={120} />
          {roles.map(role => (
            <Table.Column
              key={role.id}
              title={role.displayName}
              dataIndex="id"
              render={(permId) => (
                <Checkbox
                  defaultChecked={role.permissions.includes(`${permissions.find(p => p.id === permId)?.resource}_${permissions.find(p => p.id === permId)?.action}`)}
                  disabled={role.isSystem}
                />
              )}
            />
          ))}
        </Table>
      </Modal>
    </div>
  );
};

export default UserManagement;