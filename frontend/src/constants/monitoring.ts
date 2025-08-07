// Monitoring-related constants

// Refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  SCHEDULE_MONITOR: 30000, // 30 seconds
  SYSTEM_METRICS: 60000,   // 1 minute
  REAL_TIME: 5000          // 5 seconds for critical metrics
} as const;

// Status configurations
export const STATUS_CONFIG = {
  running: { color: 'processing', label: 'Running' },
  success: { color: 'success', label: 'Success' },
  failed: { color: 'error', label: 'Failed' },
  cancelled: { color: 'default', label: 'Cancelled' }
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 80, critical: 95 },
  disk: { warning: 75, critical: 90 },
  response_time: { warning: 1000, critical: 3000 } // in ms
} as const;

// Chart colors
export const CHART_COLORS = {
  primary: '#0088FE',
  success: '#00C49F',
  warning: '#FFBB28',
  danger: '#FF8042',
  info: '#8884d8'
} as const;

// Time range options
export const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' }
] as const;

// Table pagination
export const PAGINATION = {
  pageSize: 10,
  modalPageSize: 5,
  activityPageSize: 5
} as const;

// Status colors for metrics
export const METRIC_STATUS_COLORS = {
  normal: '#52c41a',
  warning: '#faad14',
  critical: '#ff4d4f',
  default: '#999'
} as const;

// Animation durations
export const ANIMATION = {
  refreshSpin: 300,
  modalTransition: 200
} as const;