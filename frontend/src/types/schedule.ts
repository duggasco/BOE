/**
 * Schedule-related types for the BOE system
 */

/**
 * Schedule frequency options
 */
export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Schedule status
 */
export type ScheduleStatus = 'active' | 'paused' | 'disabled' | 'error';

/**
 * Execution status
 */
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  cron_expression?: string;
  time?: string; // HH:MM format
  day_of_week?: number; // 0-6 (Sunday to Saturday)
  day_of_month?: number; // 1-31
  timezone: string;
  start_date?: string;
  end_date?: string;
}

/**
 * Distribution configuration for local storage
 */
export interface LocalDistributionConfig {
  base_path: string;
  create_subdirs: boolean;
  filename_pattern: string;
}

/**
 * Email distribution configuration
 */
export interface EmailDistributionConfig {
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  custom_message?: string;
  include_attachment: boolean;
  max_attachment_size?: number;
}

/**
 * Cloud storage distribution configuration
 */
export interface CloudDistributionConfig {
  provider: 's3' | 'azure' | 'gcs';
  bucket: string;
  path: string;
  access_key_id?: string;
  secret_access_key?: string;
}

/**
 * SFTP distribution configuration
 */
export interface SftpDistributionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  remote_path: string;
}

/**
 * Webhook distribution configuration
 */
export interface WebhookDistributionConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  auth_type?: 'none' | 'basic' | 'bearer' | 'api_key';
  auth_value?: string;
}

/**
 * Combined distribution configuration
 */
export interface DistributionConfig {
  local?: LocalDistributionConfig;
  email?: EmailDistributionConfig;
  cloud?: CloudDistributionConfig;
  sftp?: SftpDistributionConfig;
  webhook?: WebhookDistributionConfig;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  include_headers?: boolean;
  compress?: boolean;
  password_protect?: boolean;
  password?: string;
  filters?: Record<string, any>;
  columns?: string[];
}

/**
 * Main schedule interface
 */
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  report_id: string;
  report_name?: string;
  user_id: string;
  schedule_config: ScheduleConfig;
  distribution_config: DistributionConfig;
  export_config: ExportConfig;
  is_active: boolean;
  last_run?: string;
  next_run?: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Schedule creation request
 */
export interface ScheduleCreate {
  name: string;
  description?: string;
  report_id: string;
  schedule_config: ScheduleConfig;
  distribution_config: DistributionConfig;
  export_config: ExportConfig;
  is_active?: boolean;
}

/**
 * Schedule update request
 */
export interface ScheduleUpdate {
  name?: string;
  description?: string;
  schedule_config?: Partial<ScheduleConfig>;
  distribution_config?: Partial<DistributionConfig>;
  export_config?: Partial<ExportConfig>;
  is_active?: boolean;
}

/**
 * Schedule execution record
 */
export interface ScheduleExecution {
  id: string;
  schedule_id: string;
  started_at: string;
  completed_at?: string;
  status: ExecutionStatus;
  error_message?: string;
  export_id?: string;
  export_path?: string;
  export_size?: number;
  delivery_info?: Record<string, any>;
  retry_count: number;
  created_at: string;
}

/**
 * Distribution template for reusable configurations
 */
export interface DistributionTemplate {
  id: string;
  name: string;
  description?: string;
  distribution_config: DistributionConfig;
  user_id: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Email test request
 */
export interface EmailTestRequest {
  recipient: string;
  subject?: string;
  message?: string;
}