import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

// Type definitions for export configuration
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type DestinationType = 'download' | 'email' | 'sftp' | 'filesystem';
export type ScheduleType = 'immediate' | 'once' | 'daily' | 'weekly' | 'monthly';
export type PromptType = 'static' | 'dynamic';

export interface CsvFormatOptions {
  delimiter: ',' | ';' | '\t' | '|';
  includeHeaders: boolean;
  encoding: 'utf-8' | 'utf-16' | 'ascii';
}

export interface XlsxFormatOptions {
  sheetName: string;
  freezePanes: boolean;
  autoWidth: boolean;
  includeFormulas: boolean;
}

export interface PdfFormatOptions {
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'A3' | 'Letter' | 'Legal';
  includeCharts: boolean;
  headerFooter: boolean;
}

export interface EmailConfig {
  recipients: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachmentName: string;
}

export interface SftpConfig {
  connectionId: string | null; // Reference to pre-configured connection
  remotePath: string;
  overwrite: boolean;
}

export interface FilesystemConfig {
  path: string;
  overwrite: boolean;
  createPath: boolean;
}

export interface ScheduleConfig {
  type: ScheduleType;
  startDate: string; // ISO date string
  startTime: string; // HH:mm format
  endDate?: string; // ISO date string
  timezone: string;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  active: boolean;
}

export interface PromptValue {
  promptId: string;
  displayName: string;
  type: PromptType;
  value: any;
  // For dynamic prompts
  expression?: string; // e.g., "TODAY()-1" for yesterday
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ExportState {
  isOpen: boolean;
  reportId: string | null;
  reportName: string | null;
  
  // Format configuration
  format: ExportFormat;
  formatOptions: {
    csv: CsvFormatOptions;
    xlsx: XlsxFormatOptions;
    pdf: PdfFormatOptions;
  };
  
  // Common options
  includeFilters: boolean;
  includeTimestamp: boolean;
  includeMetadata: boolean;
  
  // Destination configuration
  destination: DestinationType;
  emailConfig: EmailConfig;
  sftpConfig: SftpConfig;
  filesystemConfig: FilesystemConfig;
  
  // Scheduling
  schedule: ScheduleConfig;
  
  // Prompts
  promptValues: Record<string, PromptValue>;
  availablePrompts: PromptValue[]; // Prompts available for the current report
  
  // UI State
  activeTab: 'format' | 'destination' | 'schedule' | 'prompts';
  validation: {
    errors: ValidationError[];
    isValid: boolean;
  };
  
  // Async state
  status: 'idle' | 'validating' | 'exporting' | 'scheduling' | 'succeeded' | 'failed';
  error: string | null;
  lastExportId: string | null;
}

const initialState: ExportState = {
  isOpen: false,
  reportId: null,
  reportName: null,
  
  format: 'xlsx',
  formatOptions: {
    csv: {
      delimiter: ',',
      includeHeaders: true,
      encoding: 'utf-8'
    },
    xlsx: {
      sheetName: 'Report',
      freezePanes: true,
      autoWidth: true,
      includeFormulas: false
    },
    pdf: {
      orientation: 'portrait',
      pageSize: 'A4',
      includeCharts: true,
      headerFooter: true
    }
  },
  
  includeFilters: true,
  includeTimestamp: false,
  includeMetadata: false,
  
  destination: 'download',
  emailConfig: {
    recipients: [],
    cc: [],
    bcc: [],
    subject: '',
    body: '',
    attachmentName: 'report_{date}'
  },
  sftpConfig: {
    connectionId: null,
    remotePath: '',
    overwrite: false
  },
  filesystemConfig: {
    path: '',
    overwrite: false,
    createPath: true
  },
  
  schedule: {
    type: 'immediate',
    startDate: '',
    startTime: '',
    timezone: 'UTC',
    active: false
  },
  
  promptValues: {},
  availablePrompts: [],
  
  activeTab: 'format',
  validation: {
    errors: [],
    isValid: true
  },
  
  status: 'idle',
  error: null,
  lastExportId: null
};

export const exportSlice = createSlice({
  name: 'export',
  initialState,
  reducers: {
    // Dialog control
    openExportDialog: (state, action: PayloadAction<{ reportId: string; reportName: string }>) => {
      state.isOpen = true;
      state.reportId = action.payload.reportId;
      state.reportName = action.payload.reportName;
      state.status = 'idle';
      state.error = null;
    },
    
    closeExportDialog: (state) => {
      state.isOpen = false;
      state.validation.errors = [];
      state.status = 'idle';
      state.error = null;
    },
    
    setActiveTab: (state, action: PayloadAction<ExportState['activeTab']>) => {
      state.activeTab = action.payload;
    },
    
    // Format configuration
    setFormat: (state, action: PayloadAction<ExportFormat>) => {
      state.format = action.payload;
    },
    
    updateCsvOptions: (state, action: PayloadAction<Partial<CsvFormatOptions>>) => {
      state.formatOptions.csv = { ...state.formatOptions.csv, ...action.payload };
    },
    
    updateXlsxOptions: (state, action: PayloadAction<Partial<XlsxFormatOptions>>) => {
      state.formatOptions.xlsx = { ...state.formatOptions.xlsx, ...action.payload };
    },
    
    updatePdfOptions: (state, action: PayloadAction<Partial<PdfFormatOptions>>) => {
      state.formatOptions.pdf = { ...state.formatOptions.pdf, ...action.payload };
    },
    
    setCommonOptions: (state, action: PayloadAction<{
      includeFilters?: boolean;
      includeTimestamp?: boolean;
      includeMetadata?: boolean;
    }>) => {
      if (action.payload.includeFilters !== undefined) {
        state.includeFilters = action.payload.includeFilters;
      }
      if (action.payload.includeTimestamp !== undefined) {
        state.includeTimestamp = action.payload.includeTimestamp;
      }
      if (action.payload.includeMetadata !== undefined) {
        state.includeMetadata = action.payload.includeMetadata;
      }
    },
    
    // Destination configuration
    setDestination: (state, action: PayloadAction<DestinationType>) => {
      state.destination = action.payload;
    },
    
    updateEmailConfig: (state, action: PayloadAction<Partial<EmailConfig>>) => {
      state.emailConfig = { ...state.emailConfig, ...action.payload };
    },
    
    updateSftpConfig: (state, action: PayloadAction<Partial<SftpConfig>>) => {
      state.sftpConfig = { ...state.sftpConfig, ...action.payload };
    },
    
    updateFilesystemConfig: (state, action: PayloadAction<Partial<FilesystemConfig>>) => {
      state.filesystemConfig = { ...state.filesystemConfig, ...action.payload };
    },
    
    // Scheduling
    updateSchedule: (state, action: PayloadAction<Partial<ScheduleConfig>>) => {
      state.schedule = { ...state.schedule, ...action.payload };
    },
    
    toggleSchedule: (state) => {
      state.schedule.active = !state.schedule.active;
      if (!state.schedule.active) {
        state.schedule.type = 'immediate';
      }
    },
    
    // Prompts
    setAvailablePrompts: (state, action: PayloadAction<PromptValue[]>) => {
      state.availablePrompts = action.payload;
      // Initialize prompt values
      action.payload.forEach(prompt => {
        if (!state.promptValues[prompt.promptId]) {
          state.promptValues[prompt.promptId] = prompt;
        }
      });
    },
    
    updatePromptValue: (state, action: PayloadAction<{ promptId: string; value: any }>) => {
      const prompt = state.promptValues[action.payload.promptId];
      if (prompt) {
        prompt.value = action.payload.value;
      }
    },
    
    setPromptExpression: (state, action: PayloadAction<{ promptId: string; expression: string }>) => {
      const prompt = state.promptValues[action.payload.promptId];
      if (prompt) {
        prompt.expression = action.payload.expression;
        prompt.type = 'dynamic';
      }
    },
    
    // Validation
    setValidationErrors: (state, action: PayloadAction<ValidationError[]>) => {
      state.validation.errors = action.payload;
      state.validation.isValid = action.payload.length === 0;
    },
    
    clearValidationErrors: (state) => {
      state.validation.errors = [];
      state.validation.isValid = true;
    },
    
    // Async actions
    setExportStatus: (state, action: PayloadAction<ExportState['status']>) => {
      state.status = action.payload;
    },
    
    setExportError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'failed';
      }
    },
    
    exportSucceeded: (state, action: PayloadAction<{ exportId: string }>) => {
      state.status = 'succeeded';
      state.lastExportId = action.payload.exportId;
      state.error = null;
    },
    
    resetExportState: (state) => {
      Object.assign(state, initialState);
    }
  }
});

// Export actions
export const {
  openExportDialog,
  closeExportDialog,
  setActiveTab,
  setFormat,
  updateCsvOptions,
  updateXlsxOptions,
  updatePdfOptions,
  setCommonOptions,
  setDestination,
  updateEmailConfig,
  updateSftpConfig,
  updateFilesystemConfig,
  updateSchedule,
  toggleSchedule,
  setAvailablePrompts,
  updatePromptValue,
  setPromptExpression,
  setValidationErrors,
  clearValidationErrors,
  setExportStatus,
  setExportError,
  exportSucceeded,
  resetExportState
} = exportSlice.actions;

// Selectors
export const selectExport = (state: RootState) => state.export;
export const selectExportFormat = (state: RootState) => state.export.format;
export const selectExportDestination = (state: RootState) => state.export.destination;
export const selectExportSchedule = (state: RootState) => state.export.schedule;
export const selectExportPrompts = (state: RootState) => state.export.promptValues;
export const selectExportValidation = (state: RootState) => state.export.validation;
export const selectExportStatus = (state: RootState) => state.export.status;

// Get format-specific options based on current format
export const selectCurrentFormatOptions = (state: RootState) => {
  const format = state.export.format;
  return state.export.formatOptions[format];
};

// Get destination-specific config based on current destination
export const selectCurrentDestinationConfig = (state: RootState) => {
  const destination = state.export.destination;
  switch (destination) {
    case 'email':
      return state.export.emailConfig;
    case 'sftp':
      return state.export.sftpConfig;
    case 'filesystem':
      return state.export.filesystemConfig;
    default:
      return null;
  }
};

export default exportSlice.reducer;