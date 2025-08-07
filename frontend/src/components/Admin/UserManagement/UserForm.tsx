import React from 'react';
import {
  Form,
  Input,
  Select,
  Row,
  Col,
  Switch,
  Divider,
  Alert,
  Space,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';

const { Option } = Select;

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  status: 'active' | 'inactive' | 'locked' | 'suspended';
  roles: string[];
  groups: string[];
  createdAt: string;
  lastLogin?: string;
  lastPasswordChange?: string;
  mfaEnabled: boolean;
  avatar?: string;
}

interface UserFormProps {
  form: FormInstance;
  selectedUser: User | null;
  roles: Array<{ id: string; name: string; displayName: string }>;
  groups: Array<{ id: string; name: string; displayName: string }>;
}

const UserForm: React.FC<UserFormProps> = ({ form, selectedUser, roles, groups }) => {
  return (
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please enter username' },
              { pattern: /^[a-z0-9._]+$/, message: 'Username must be lowercase with dots/underscores only' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="john.doe" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="john.doe@company.com" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: 'Please enter first name' }]}
          >
            <Input placeholder="John" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: 'Please enter last name' }]}
          >
            <Input placeholder="Doe" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="displayName"
        label="Display Name"
        rules={[{ required: true, message: 'Please enter display name' }]}
      >
        <Input placeholder="John Doe" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="phone"
            label="Phone"
          >
            <Input prefix={<PhoneOutlined />} placeholder="+1 555-1234" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="department"
            label="Department"
          >
            <Select placeholder="Select department">
              <Option value="Finance">Finance</Option>
              <Option value="IT">IT</Option>
              <Option value="HR">HR</Option>
              <Option value="Operations">Operations</Option>
              <Option value="Sales">Sales</Option>
              <Option value="Marketing">Marketing</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="jobTitle"
        label="Job Title"
      >
        <Input placeholder="Senior Analyst" />
      </Form.Item>

      <Form.Item
        name="roles"
        label="Roles"
      >
        <Select mode="multiple" placeholder="Select roles">
          {roles.map(role => (
            <Option key={role.id} value={role.id}>
              {role.displayName}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="groups"
        label="Groups"
      >
        <Select mode="multiple" placeholder="Select groups">
          {groups.map(group => (
            <Option key={group.id} value={group.id}>
              {group.displayName}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="status"
            label="Status"
            initialValue="active"
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
              <Option value="suspended">Suspended</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="mfaEnabled"
            label="Multi-Factor Authentication"
            valuePropName="checked"
          >
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>
        </Col>
      </Row>

      {selectedUser && (
        <>
          <Divider />
          <Alert
            message="Account Information"
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>Created: {dayjs(selectedUser.createdAt).format('YYYY-MM-DD HH:mm')}</div>
                {selectedUser.lastLogin && (
                  <div>Last Login: {dayjs(selectedUser.lastLogin).format('YYYY-MM-DD HH:mm')}</div>
                )}
                {selectedUser.lastPasswordChange && (
                  <div>Last Password Change: {dayjs(selectedUser.lastPasswordChange).format('YYYY-MM-DD')}</div>
                )}
              </Space>
            }
            type="info"
            showIcon
          />
        </>
      )}
    </Form>
  );
};

export default UserForm;