import type { ExportState, ValidationError } from '../store/slices/exportSlice';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Path validation - check for dangerous patterns
const DANGEROUS_PATH_PATTERNS = [
  /\.\.\//g,  // Directory traversal
  /^\/etc/,   // System directories
  /^\/usr/,
  /^\/bin/,
  /^\/sbin/,
  /^\/proc/,
  /^\/sys/,
  /^\/dev/,
  /^C:\\Windows/i,  // Windows system directories
  /^C:\\Program Files/i,
];

export function validateExportConfig(state: ExportState): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Validate based on destination type
  switch (state.destination) {
    case 'email':
      errors.push(...validateEmailConfig(state));
      break;
    case 'sftp':
      errors.push(...validateSftpConfig(state));
      break;
    case 'filesystem':
      errors.push(...validateFilesystemConfig(state));
      break;
  }
  
  // Validate schedule if enabled
  if (state.schedule.active) {
    errors.push(...validateScheduleConfig(state));
  }
  
  // Validate prompts
  errors.push(...validatePrompts(state));
  
  // Validate format-specific options
  errors.push(...validateFormatOptions(state));
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateEmailConfig(state: ExportState): ValidationError[] {
  const errors: ValidationError[] = [];
  const { emailConfig } = state;
  
  // Validate recipients
  if (!emailConfig.recipients || emailConfig.recipients.length === 0) {
    errors.push({
      field: 'recipients',
      message: 'At least one recipient email is required'
    });
  } else {
    const invalidEmails = emailConfig.recipients.filter(email => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      errors.push({
        field: 'recipients',
        message: `Invalid email addresses: ${invalidEmails.join(', ')}`
      });
    }
  }
  
  // Validate CC emails if provided
  if (emailConfig.cc && emailConfig.cc.length > 0) {
    const invalidCc = emailConfig.cc.filter(email => !EMAIL_REGEX.test(email));
    if (invalidCc.length > 0) {
      errors.push({
        field: 'cc',
        message: `Invalid CC email addresses: ${invalidCc.join(', ')}`
      });
    }
  }
  
  // Validate BCC emails if provided
  if (emailConfig.bcc && emailConfig.bcc.length > 0) {
    const invalidBcc = emailConfig.bcc.filter(email => !EMAIL_REGEX.test(email));
    if (invalidBcc.length > 0) {
      errors.push({
        field: 'bcc',
        message: `Invalid BCC email addresses: ${invalidBcc.join(', ')}`
      });
    }
  }
  
  // Validate subject
  if (!emailConfig.subject || emailConfig.subject.trim().length === 0) {
    errors.push({
      field: 'subject',
      message: 'Email subject is required'
    });
  }
  
  // Validate attachment name
  if (!emailConfig.attachmentName || emailConfig.attachmentName.trim().length === 0) {
    errors.push({
      field: 'attachmentName',
      message: 'Attachment name is required'
    });
  }
  
  return errors;
}

function validateSftpConfig(state: ExportState): ValidationError[] {
  const errors: ValidationError[] = [];
  const { sftpConfig } = state;
  
  // Validate connection selection
  if (!sftpConfig.connectionId) {
    errors.push({
      field: 'connectionId',
      message: 'Please select an SFTP connection'
    });
  }
  
  // Validate remote path
  if (!sftpConfig.remotePath || sftpConfig.remotePath.trim().length === 0) {
    errors.push({
      field: 'remotePath',
      message: 'Remote path is required'
    });
  } else if (sftpConfig.remotePath.includes('..')) {
    errors.push({
      field: 'remotePath',
      message: 'Path cannot contain directory traversal patterns (..)'
    });
  }
  
  return errors;
}

function validateFilesystemConfig(state: ExportState): ValidationError[] {
  const errors: ValidationError[] = [];
  const { filesystemConfig } = state;
  
  // Validate path
  if (!filesystemConfig.path || filesystemConfig.path.trim().length === 0) {
    errors.push({
      field: 'path',
      message: 'File path is required'
    });
  } else {
    // Check for dangerous patterns
    const isDangerous = DANGEROUS_PATH_PATTERNS.some(pattern => 
      pattern.test(filesystemConfig.path)
    );
    
    if (isDangerous) {
      errors.push({
        field: 'path',
        message: 'Path contains potentially dangerous patterns or points to system directories'
      });
    }
  }
  
  return errors;
}

function validateScheduleConfig(state: ExportState): ValidationError[] {
  const errors: ValidationError[] = [];
  const { schedule } = state;
  
  // Validate start date
  if (!schedule.startDate) {
    errors.push({
      field: 'startDate',
      message: 'Start date is required for scheduled exports'
    });
  } else {
    const startDate = new Date(schedule.startDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (startDate < now) {
      errors.push({
        field: 'startDate',
        message: 'Start date cannot be in the past'
      });
    }
  }
  
  // Validate start time
  if (!schedule.startTime) {
    errors.push({
      field: 'startTime',
      message: 'Start time is required for scheduled exports'
    });
  } else if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(schedule.startTime)) {
    errors.push({
      field: 'startTime',
      message: 'Invalid time format. Use HH:mm (24-hour format)'
    });
  }
  
  // Validate end date if provided
  if (schedule.endDate) {
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);
    
    if (endDate <= startDate) {
      errors.push({
        field: 'endDate',
        message: 'End date must be after start date'
      });
    }
  }
  
  // Validate weekly schedule
  if (schedule.type === 'weekly' && (schedule.dayOfWeek === undefined || schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6)) {
    errors.push({
      field: 'dayOfWeek',
      message: 'Please select a day of the week'
    });
  }
  
  // Validate monthly schedule
  if (schedule.type === 'monthly') {
    if (schedule.dayOfMonth === undefined || schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) {
      errors.push({
        field: 'dayOfMonth',
        message: 'Please select a valid day of the month (1-31)'
      });
    }
  }
  
  return errors;
}

function validatePrompts(state: ExportState): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check each prompt has a value or expression
  Object.values(state.promptValues).forEach(prompt => {
    if (prompt.type === 'static' && (prompt.value === null || prompt.value === undefined || prompt.value === '')) {
      errors.push({
        field: `prompt_${prompt.promptId}`,
        message: `Value required for prompt: ${prompt.displayName}`
      });
    }
    
    if (prompt.type === 'dynamic' && (!prompt.expression || prompt.expression.trim().length === 0)) {
      errors.push({
        field: `prompt_${prompt.promptId}`,
        message: `Expression required for dynamic prompt: ${prompt.displayName}`
      });
    }
  });
  
  return errors;
}

function validateFormatOptions(state: ExportState): ValidationError[] {
  const errors: ValidationError[] = [];
  
  switch (state.format) {
    case 'xlsx':
      const { xlsx } = state.formatOptions;
      if (!xlsx.sheetName || xlsx.sheetName.trim().length === 0) {
        errors.push({
          field: 'sheetName',
          message: 'Sheet name is required for Excel export'
        });
      } else if (xlsx.sheetName.length > 31) {
        errors.push({
          field: 'sheetName',
          message: 'Sheet name must be 31 characters or less'
        });
      } else if (/[\\\/\?\*\[\]:]/.test(xlsx.sheetName)) {
        errors.push({
          field: 'sheetName',
          message: 'Sheet name contains invalid characters'
        });
      }
      break;
      
    case 'csv':
      // CSV options are generally safe, no specific validation needed
      break;
      
    case 'pdf':
      // PDF options are generally safe, no specific validation needed
      break;
  }
  
  return errors;
}

// Helper function to sanitize file paths
export function sanitizePath(path: string): string {
  // Remove any directory traversal attempts
  let sanitized = path.replace(/\.\.\//g, '');
  
  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Normalize slashes
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove duplicate slashes
  sanitized = sanitized.replace(/\/+/g, '/');
  
  return sanitized;
}

// Helper function to generate default file name
export function generateFileName(reportName: string, format: string): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedName = reportName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitizedName}_${date}.${format}`;
}