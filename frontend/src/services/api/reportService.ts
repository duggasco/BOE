/**
 * Report Service
 * Handles all report-related API operations
 */

import { api } from './client';

// Types
export interface Report {
  id: string;
  name: string;
  description?: string;
  report_type: 'standard' | 'dashboard' | 'template' | 'scheduled';
  definition: ReportDefinition;
  owner_id: string;
  folder_id?: string;
  is_template: boolean;
  is_published: boolean;
  tags?: string[];
  created_at: string;
  updated_at: string;
  last_executed?: string;
  execution_count: number;
  version: number;
  owner?: {
    id: string;
    full_name: string;
    email: string;
  };
  folder?: {
    id: string;
    name: string;
    path: string;
  };
}

export interface ReportDefinition {
  sections: ReportSection[];
  layout?: {
    type: 'grid' | 'flow';
    columns?: number;
  };
  filters?: ReportFilter[];
  parameters?: ReportParameter[];
  styling?: {
    theme?: string;
    customCSS?: string;
  };
}

export interface ReportSection {
  id: string;
  type: 'table' | 'chart' | 'text' | 'container';
  title?: string;
  dataQuery?: {
    dimensions: string[];
    measures: string[];
    filters?: any[];
    orderBy?: any[];
    limit?: number;
  };
  config?: any;
  layout?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
}

export interface ReportFilter {
  field: string;
  operator: string;
  value: any;
  label?: string;
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'list';
  label?: string;
  defaultValue?: any;
  required?: boolean;
  options?: any[];
}

export interface ReportCreateData {
  name: string;
  description?: string;
  report_type?: 'standard' | 'dashboard' | 'template' | 'scheduled';
  definition: ReportDefinition;
  folder_id?: string;
  is_template?: boolean;
  is_published?: boolean;
  tags?: string[];
}

export interface ReportUpdateData {
  name?: string;
  description?: string;
  definition?: ReportDefinition;
  folder_id?: string;
  is_template?: boolean;
  is_published?: boolean;
  tags?: string[];
}

export interface ReportListParams {
  skip?: number;
  limit?: number;
  folder_id?: string;
  search?: string;
  is_template?: boolean;
  report_type?: 'standard' | 'dashboard' | 'template' | 'scheduled';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface ReportExecuteParams {
  parameters?: Record<string, any>;
  format?: 'json' | 'csv' | 'xlsx' | 'pdf';
  limit?: number;
  offset?: number;
}

export interface ReportExecutionResult {
  report_id: string;
  execution_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  result_data?: any;
  error?: string;
  row_count?: number;
  execution_time_ms?: number;
}

export interface ReportVersion {
  id: string;
  report_id: string;
  version: number;
  definition: ReportDefinition;
  created_at: string;
  created_by: string;
  change_description?: string;
}

export interface ReportExportJob {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'csv' | 'xlsx' | 'pdf';
  file_url?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

class ReportService {
  /**
   * List reports with optional filters
   */
  async listReports(params?: ReportListParams): Promise<PaginatedResponse<Report>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params?.folder_id) queryParams.append('folder_id', params.folder_id);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.is_template !== undefined) queryParams.append('is_template', params.is_template.toString());
      if (params?.report_type) queryParams.append('report_type', params.report_type);
      
      const response = await api.get<PaginatedResponse<Report>>(`/reports?${queryParams.toString()}`);
      return response;
    } catch (error: any) {
      console.error('[List Reports Error]', error);
      throw new Error(error.message || 'Failed to list reports');
    }
  }

  /**
   * Get a specific report by ID
   */
  async getReport(reportId: string): Promise<Report> {
    try {
      const report = await api.get<Report>(`/reports/${reportId}`);
      return report;
    } catch (error: any) {
      console.error('[Get Report Error]', error);
      if (error.status === 404) {
        throw new Error('Report not found');
      }
      throw new Error(error.message || 'Failed to get report');
    }
  }

  /**
   * Create a new report
   */
  async createReport(data: ReportCreateData): Promise<Report> {
    try {
      const report = await api.post<Report>('/reports', data);
      return report;
    } catch (error: any) {
      console.error('[Create Report Error]', error);
      if (error.status === 403) {
        throw new Error('You do not have permission to create reports');
      }
      throw new Error(error.message || 'Failed to create report');
    }
  }

  /**
   * Update an existing report
   */
  async updateReport(reportId: string, data: ReportUpdateData): Promise<Report> {
    try {
      const report = await api.put<Report>(`/reports/${reportId}`, data);
      return report;
    } catch (error: any) {
      console.error('[Update Report Error]', error);
      if (error.status === 403) {
        throw new Error('You do not have permission to update this report');
      }
      if (error.status === 404) {
        throw new Error('Report not found');
      }
      throw new Error(error.message || 'Failed to update report');
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await api.delete(`/reports/${reportId}`);
    } catch (error: any) {
      console.error('[Delete Report Error]', error);
      if (error.status === 403) {
        throw new Error('You do not have permission to delete this report');
      }
      if (error.status === 404) {
        throw new Error('Report not found');
      }
      throw new Error(error.message || 'Failed to delete report');
    }
  }

  /**
   * Clone/duplicate a report
   */
  async cloneReport(reportId: string, newName?: string): Promise<Report> {
    try {
      const data = newName ? { name: newName } : {};
      const report = await api.post<Report>(`/reports/${reportId}/clone`, data);
      return report;
    } catch (error: any) {
      console.error('[Clone Report Error]', error);
      if (error.status === 403) {
        throw new Error('You do not have permission to clone this report');
      }
      if (error.status === 404) {
        throw new Error('Report not found');
      }
      throw new Error(error.message || 'Failed to clone report');
    }
  }

  /**
   * Execute a report
   */
  async executeReport(reportId: string, params?: ReportExecuteParams): Promise<ReportExecutionResult> {
    try {
      const result = await api.post<ReportExecutionResult>(
        `/reports/${reportId}/execute`,
        params || {}
      );
      return result;
    } catch (error: any) {
      console.error('[Execute Report Error]', error);
      if (error.status === 403) {
        throw new Error('You do not have permission to execute this report');
      }
      if (error.status === 404) {
        throw new Error('Report not found');
      }
      throw new Error(error.message || 'Failed to execute report');
    }
  }

  /**
   * Get report versions
   */
  async getReportVersions(reportId: string): Promise<ReportVersion[]> {
    try {
      const versions = await api.get<ReportVersion[]>(`/reports/${reportId}/versions`);
      return versions;
    } catch (error: any) {
      console.error('[Get Report Versions Error]', error);
      throw new Error(error.message || 'Failed to get report versions');
    }
  }

  /**
   * Export a report to CSV
   */
  async exportToCSV(reportId: string, params?: any): Promise<ReportExportJob> {
    try {
      const job = await api.post<ReportExportJob>(`/export/${reportId}/csv`, params);
      return job;
    } catch (error: any) {
      console.error('[Export CSV Error]', error);
      throw new Error(error.message || 'Failed to export report to CSV');
    }
  }

  /**
   * Export a report to Excel
   */
  async exportToExcel(reportId: string, params?: any): Promise<ReportExportJob> {
    try {
      const job = await api.post<ReportExportJob>(`/export/${reportId}/xlsx`, params);
      return job;
    } catch (error: any) {
      console.error('[Export Excel Error]', error);
      throw new Error(error.message || 'Failed to export report to Excel');
    }
  }

  /**
   * Export a report to PDF
   */
  async exportToPDF(reportId: string, params?: any): Promise<ReportExportJob> {
    try {
      const job = await api.post<ReportExportJob>(`/export/${reportId}/pdf`, params);
      return job;
    } catch (error: any) {
      console.error('[Export PDF Error]', error);
      throw new Error(error.message || 'Failed to export report to PDF');
    }
  }

  /**
   * Check export job status
   */
  async getExportStatus(jobId: string): Promise<ReportExportJob> {
    try {
      const status = await api.get<ReportExportJob>(`/export/status/${jobId}`);
      return status;
    } catch (error: any) {
      console.error('[Get Export Status Error]', error);
      throw new Error(error.message || 'Failed to get export status');
    }
  }

  /**
   * Download exported file
   */
  async downloadExportedFile(fileUrl: string): Promise<void> {
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileUrl.split('/').pop() || 'export';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('[Download Export Error]', error);
      throw new Error(error.message || 'Failed to download exported file');
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();

// Export default
export default reportService;