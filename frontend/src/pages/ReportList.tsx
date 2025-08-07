import React from 'react';
import { Card, Table, Button, Space, Skeleton } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useViewport } from '../contexts/ViewportContext';
import LoadingState, { TableSkeleton } from '../components/common/LoadingStates';
import { useAbortableRequest } from '../hooks/useAbortableRequest';

const ReportList: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useViewport();
  
  // Fetch reports from localStorage with simulated delay
  const fetchReports = async (signal: AbortSignal) => {
    // Simulate network delay
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, 1000);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    
    // Get saved reports from localStorage
    const savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
    
    // Transform to display format
    const reports = savedReports.map((report: any) => ({
      id: report.id,
      name: report.name,
      description: report.description,
      lastModified: new Date(report.updatedAt).toLocaleDateString(),
      owner: 'Demo User',
      sections: report.sections?.length || 0,
    }));
    
    return reports;
  };

  const { data, loading, error, isEmpty, retry } = useAbortableRequest(
    fetchReports,
    [],
    { loadingDelayType: 'network' }
  );

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Sections',
      dataIndex: 'sections',
      key: 'sections',
      width: 100,
      responsive: ['md'] as any,
    },
    { 
      title: 'Last Modified', 
      dataIndex: 'lastModified', 
      key: 'lastModified',
      responsive: ['md'] as any,
    },
    { 
      title: 'Owner', 
      dataIndex: 'owner', 
      key: 'owner',
      responsive: ['lg'] as any,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space size={isMobile ? 'small' : 'middle'}>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/reports/${record.id}/edit`)}
            size={isMobile ? 'small' : 'middle'}
          />
          <Button 
            icon={<DeleteOutlined />} 
            danger 
            size={isMobile ? 'small' : 'middle'}
          />
        </Space>
      ),
    },
  ];

  const handleCreateReport = () => {
    navigate('/reports/new');
  };

  return (
    <Card 
      title={
        <div className="page-header" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: '12px',
          width: '100%'
        }}>
          <span style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 600 }}>Reports</span>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/reports/new')}
            size={isMobile ? 'middle' : 'large'}
            className={isMobile ? 'mobile-full-width' : ''}
            data-tour="new-report-btn"
          >
            New Report
          </Button>
        </div>
      }
      style={{
        width: '100%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        borderRadius: '8px',
      }}
      styles={{ body: { padding: 0 } }}
    >
      <LoadingState
        loading={loading}
        error={error}
        empty={isEmpty}
        emptyType="no-reports"
        onRetry={retry}
        onAction={handleCreateReport}
        skeleton={<TableSkeleton columns={4} rows={5} showActions />}
      >
        <Table 
          dataSource={data || []} 
          columns={columns} 
          rowKey="id"
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            defaultPageSize: 10,
          }}
          style={{ width: '100%' }}
          size="middle"
        />
      </LoadingState>
    </Card>
  );
};

export default ReportList;