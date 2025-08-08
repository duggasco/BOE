import React, { useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Button, Space, Skeleton, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { 
  fetchReports, 
  deleteReport, 
  cloneReport,
  setSearchQuery,
  setPagination,
  selectReports,
  selectIsLoading,
  selectIsDeleting,
  selectError,
  selectTotalCount,
  selectCurrentPage,
  selectPageSize,
  clearError
} from '../store/slices/reportSlice';
import { useViewport } from '../contexts/ViewportContext';
import LoadingState, { TableSkeleton } from '../components/common/LoadingStates';
import { useAuth } from '../hooks/useAuth';

const { confirm } = Modal;

const ReportList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isMobile } = useViewport();
  const { hasPermission } = useAuth();
  
  // Redux state
  const reports = useSelector(selectReports);
  const isLoading = useSelector(selectIsLoading);
  const isDeleting = useSelector(selectIsDeleting);
  const error = useSelector(selectError);
  const totalCount = useSelector(selectTotalCount);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  
  // Permissions
  const canCreate = hasPermission('reports', 'create');
  const canEdit = hasPermission('reports', 'update');
  const canDelete = hasPermission('reports', 'delete');
  
  // Fetch reports on mount and when pagination changes
  useEffect(() => {
    const params = {
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
    };
    dispatch(fetchReports(params));
  }, [dispatch, currentPage, pageSize]);
  
  // Show error message
  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);
  
  // Handle pagination change
  const handleTableChange = (pagination: any) => {
    dispatch(setPagination({
      page: pagination.current,
      pageSize: pagination.pageSize,
    }));
  };
  
  // Handle delete with refetch
  const handleDelete = useCallback((reportId: string, reportName: string) => {
    confirm({
      title: 'Delete Report',
      icon: <ExclamationCircleOutlined />,
      content: (
        <>
          Are you sure you want to delete "<strong>{reportName}</strong>"? 
          This action cannot be undone.
        </>
      ),
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const params = {
            skip: (currentPage - 1) * pageSize,
            limit: pageSize,
          };
          await dispatch(deleteReport({ reportId, params })).unwrap();
          message.success('Report deleted successfully');
        } catch (err) {
          // Error is handled by Redux
        }
      },
    });
  }, [dispatch, currentPage, pageSize]);
  
  // Handle clone with refetch
  const handleClone = useCallback(async (reportId: string, reportName: string) => {
    try {
      const newName = `${reportName} (Copy)`;
      await dispatch(cloneReport({ reportId, newName })).unwrap();
      message.success('Report cloned successfully');
      // Refetch to show the new cloned report
      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      dispatch(fetchReports(params));
    } catch (err) {
      // Error is handled by Redux
    }
  }, [dispatch, currentPage, pageSize]);
  
  // Memoize columns for performance
  const columns = useMemo(() => [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.description && (
            <div style={{ fontSize: 12, color: '#666' }}>{record.description}</div>
          )}
        </div>
      ),
    },
    { 
      title: 'Type', 
      dataIndex: 'report_type', 
      key: 'report_type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          standard: 'Standard',
          dashboard: 'Dashboard',
          template: 'Template',
          scheduled: 'Scheduled'
        };
        return typeMap[type] || type;
      }
    },
    { 
      title: 'Owner', 
      dataIndex: 'owner', 
      key: 'owner',
      width: 150,
      render: (owner: any) => owner?.full_name || owner?.email || 'Unknown',
      responsive: ['md'] as any,
    },
    { 
      title: 'Last Modified', 
      dataIndex: 'updated_at', 
      key: 'updated_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
      responsive: ['lg'] as any,
    },
    { 
      title: 'Actions', 
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space size="small">
          {canEdit && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/reports/${record.id}/edit`)}
              title="Edit Report"
            />
          )}
          {canCreate && (
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleClone(record.id, record.name)}
              title="Clone Report"
            />
          )}
          {canDelete && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id, record.name)}
              title="Delete Report"
            />
          )}
        </Space>
      ),
    },
  ], [canEdit, canCreate, canDelete, navigate, handleClone, handleDelete]);

  const mobileColumns = useMemo(() => 
    columns.filter(col => !['owner', 'updated_at'].includes(col.key as string)),
    [columns]
  );

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Reports</span>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/reports/new')}
              size={isMobile ? 'small' : 'middle'}
            >
              New Report
            </Button>
          )}
        </div>
      }
      styles={{ 
        body: { 
          padding: isMobile ? '12px' : '24px' 
        } 
      }}
    >
      {isLoading && reports.length === 0 ? (
        <TableSkeleton />
      ) : reports.length === 0 ? (
        <LoadingState
          loading={false}
          error={null}
          isEmpty={true}
          emptyProps={{
            description: canCreate 
              ? 'No reports found. Create your first report to get started.'
              : 'No reports available.',
          }}
        />
      ) : (
        <Table
          dataSource={reports}
          columns={isMobile ? mobileColumns : columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalCount || reports.length,
            showSizeChanger: !isMobile,
            showTotal: (total) => `${total} reports`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: isMobile ? 'max-content' : undefined }}
          size={isMobile ? 'small' : 'middle'}
        />
      )}
    </Card>
  );
};

export default ReportList;