/**
 * Report Redux Slice
 * Manages report list and CRUD operations with backend API
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import reportService from '../../services/api/reportService';
import type { 
  Report, 
  ReportCreateData, 
  ReportUpdateData, 
  ReportListParams,
  ReportExecutionResult,
  ReportExportJob
} from '../../services/api/reportService';

// State interface
interface ReportState {
  reports: Report[];
  selectedReport: Report | null;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  filters: {
    folder_id?: string;
    is_template?: boolean;
    report_type?: string;
  };
  executionResults: Record<string, ReportExecutionResult>;
  exportJobs: Record<string, ReportExportJob>;
}

// Initial state
const initialState: ReportState = {
  reports: [],
  selectedReport: null,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  searchQuery: '',
  filters: {},
  executionResults: {},
  exportJobs: {},
};

// Async thunks
export const fetchReports = createAsyncThunk(
  'reports/fetchReports',
  async (params?: ReportListParams, { rejectWithValue }) => {
    try {
      const response = await reportService.listReports(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch reports');
    }
  }
);

export const fetchReport = createAsyncThunk(
  'reports/fetchReport',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const report = await reportService.getReport(reportId);
      return report;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch report');
    }
  }
);

export const createReport = createAsyncThunk(
  'reports/createReport',
  async (data: ReportCreateData, { rejectWithValue }) => {
    try {
      const report = await reportService.createReport(data);
      return report;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create report');
    }
  }
);

export const updateReport = createAsyncThunk(
  'reports/updateReport',
  async ({ id, data }: { id: string; data: ReportUpdateData }, { rejectWithValue }) => {
    try {
      const report = await reportService.updateReport(id, data);
      return report;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update report');
    }
  }
);

export const deleteReport = createAsyncThunk(
  'reports/deleteReport',
  async ({ reportId, params }: { reportId: string; params?: ReportListParams }, { rejectWithValue }) => {
    try {
      await reportService.deleteReport(reportId);
      // Refetch the current page after deletion
      const response = params ? await reportService.listReports(params) : null;
      return { reportId, refreshedData: response };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete report');
    }
  }
);

export const cloneReport = createAsyncThunk(
  'reports/cloneReport',
  async ({ reportId, newName }: { reportId: string; newName?: string }, { rejectWithValue }) => {
    try {
      const report = await reportService.cloneReport(reportId, newName);
      return report;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to clone report');
    }
  }
);

export const executeReport = createAsyncThunk(
  'reports/executeReport',
  async ({ reportId, params }: { reportId: string; params?: any }, { rejectWithValue }) => {
    try {
      const result = await reportService.executeReport(reportId, params);
      return { reportId, result };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to execute report');
    }
  }
);

export const exportReportToCSV = createAsyncThunk(
  'reports/exportToCSV',
  async ({ reportId, params }: { reportId: string; params?: any }, { rejectWithValue }) => {
    try {
      const job = await reportService.exportToCSV(reportId, params);
      return { reportId, job };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to export report');
    }
  }
);

export const exportReportToExcel = createAsyncThunk(
  'reports/exportToExcel',
  async ({ reportId, params }: { reportId: string; params?: any }, { rejectWithValue }) => {
    try {
      const job = await reportService.exportToExcel(reportId, params);
      return { reportId, job };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to export report');
    }
  }
);

export const exportReportToPDF = createAsyncThunk(
  'reports/exportToPDF',
  async ({ reportId, params }: { reportId: string; params?: any }, { rejectWithValue }) => {
    try {
      const job = await reportService.exportToPDF(reportId, params);
      return { reportId, job };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to export report');
    }
  }
);

export const checkExportStatus = createAsyncThunk(
  'reports/checkExportStatus',
  async (jobId: string, { rejectWithValue }) => {
    try {
      const status = await reportService.getExportStatus(jobId);
      // Don't download here - let the component handle it
      return status;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to check export status');
    }
  }
);

// Create slice
const reportSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    // Set search query
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    
    // Set filters
    setFilters: (state, action: PayloadAction<typeof initialState.filters>) => {
      state.filters = action.payload;
    },
    
    // Set pagination
    setPagination: (state, action: PayloadAction<{ page?: number; pageSize?: number }>) => {
      if (action.payload.page !== undefined) {
        state.currentPage = action.payload.page;
      }
      if (action.payload.pageSize !== undefined) {
        state.pageSize = action.payload.pageSize;
      }
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    
    // Clear selected report
    clearSelectedReport: (state) => {
      state.selectedReport = null;
    },
    
    // Update report in list
    updateReportInList: (state, action: PayloadAction<Report>) => {
      const index = state.reports.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.reports[index] = action.payload;
      }
      if (state.selectedReport?.id === action.payload.id) {
        state.selectedReport = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch reports
    builder
      .addCase(fetchReports.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.isLoading = false;
        state.reports = action.payload.items;
        state.totalCount = action.payload.total;
        state.error = null;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Fetch single report
    builder
      .addCase(fetchReport.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedReport = action.payload;
        state.error = null;
      })
      .addCase(fetchReport.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Create report
    builder
      .addCase(createReport.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(createReport.fulfilled, (state, action) => {
        state.isSaving = false;
        // Don't add to list - will refetch
        state.selectedReport = action.payload;
        state.error = null;
      })
      .addCase(createReport.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload as string;
      });
    
    // Update report
    builder
      .addCase(updateReport.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateReport.fulfilled, (state, action) => {
        state.isSaving = false;
        const index = state.reports.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reports[index] = action.payload;
        }
        if (state.selectedReport?.id === action.payload.id) {
          state.selectedReport = action.payload;
        }
        state.error = null;
      })
      .addCase(updateReport.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload as string;
      });
    
    // Delete report
    builder
      .addCase(deleteReport.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteReport.fulfilled, (state, action) => {
        state.isDeleting = false;
        // Update list if we have refreshed data
        if (action.payload.refreshedData) {
          state.reports = action.payload.refreshedData.items;
          state.totalCount = action.payload.refreshedData.total;
        }
        if (state.selectedReport?.id === action.payload.reportId) {
          state.selectedReport = null;
        }
        state.error = null;
      })
      .addCase(deleteReport.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      });
    
    // Clone report
    builder
      .addCase(cloneReport.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(cloneReport.fulfilled, (state, action) => {
        state.isSaving = false;
        // Don't add to list - will refetch
        state.error = null;
      })
      .addCase(cloneReport.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload as string;
      });
    
    // Execute report
    builder
      .addCase(executeReport.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(executeReport.fulfilled, (state, action) => {
        state.isLoading = false;
        state.executionResults[action.payload.reportId] = action.payload.result;
        state.error = null;
      })
      .addCase(executeReport.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Export to CSV
    builder
      .addCase(exportReportToCSV.pending, (state) => {
        state.error = null;
      })
      .addCase(exportReportToCSV.fulfilled, (state, action) => {
        state.exportJobs[action.payload.job.job_id] = action.payload.job;
      })
      .addCase(exportReportToCSV.rejected, (state, action) => {
        state.error = action.payload as string;
      });
    
    // Export to Excel
    builder
      .addCase(exportReportToExcel.pending, (state) => {
        state.error = null;
      })
      .addCase(exportReportToExcel.fulfilled, (state, action) => {
        state.exportJobs[action.payload.job.job_id] = action.payload.job;
      })
      .addCase(exportReportToExcel.rejected, (state, action) => {
        state.error = action.payload as string;
      });
    
    // Export to PDF
    builder
      .addCase(exportReportToPDF.pending, (state) => {
        state.error = null;
      })
      .addCase(exportReportToPDF.fulfilled, (state, action) => {
        state.exportJobs[action.payload.job.job_id] = action.payload.job;
      })
      .addCase(exportReportToPDF.rejected, (state, action) => {
        state.error = action.payload as string;
      });
    
    // Check export status
    builder
      .addCase(checkExportStatus.fulfilled, (state, action) => {
        state.exportJobs[action.payload.job_id] = action.payload;
        // Don't trigger download here - let component handle it
      });
  },
});

// Export actions
export const {
  setSearchQuery,
  setFilters,
  setPagination,
  clearError,
  clearSelectedReport,
  updateReportInList,
} = reportSlice.actions;

// Selectors
export const selectReports = (state: { reports: ReportState }) => state.reports.reports;
export const selectSelectedReport = (state: { reports: ReportState }) => state.reports.selectedReport;
export const selectIsLoading = (state: { reports: ReportState }) => state.reports.isLoading;
export const selectIsSaving = (state: { reports: ReportState }) => state.reports.isSaving;
export const selectIsDeleting = (state: { reports: ReportState }) => state.reports.isDeleting;
export const selectError = (state: { reports: ReportState }) => state.reports.error;
export const selectTotalCount = (state: { reports: ReportState }) => state.reports.totalCount;
export const selectCurrentPage = (state: { reports: ReportState }) => state.reports.currentPage;
export const selectPageSize = (state: { reports: ReportState }) => state.reports.pageSize;
export const selectSearchQuery = (state: { reports: ReportState }) => state.reports.searchQuery;
export const selectFilters = (state: { reports: ReportState }) => state.reports.filters;
export const selectExecutionResult = (reportId: string) => 
  (state: { reports: ReportState }) => state.reports.executionResults[reportId];
export const selectExportJob = (jobId: string) =>
  (state: { reports: ReportState }) => state.reports.exportJobs[jobId];

// Export reducer
export default reportSlice.reducer;