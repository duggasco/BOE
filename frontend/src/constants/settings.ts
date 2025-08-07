export const DATABASE_TYPES = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'snowflake', label: 'Snowflake' },
] as const;

export const TIMEZONES = [
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT/AEST)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.12.2024)' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2024/12/31)' },
] as const;

export const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'ko-KR', label: 'Korean' },
] as const;

export const STORAGE_TYPES = [
  { value: 'local', label: 'Local File System' },
  { value: 's3', label: 'AWS S3' },
  { value: 'azure', label: 'Azure Blob Storage' },
  { value: 'gcs', label: 'Google Cloud Storage' },
] as const;

export const FILE_EXTENSIONS = [
  'pdf',
  'csv',
  'xlsx',
  'xls',
  'docx',
  'doc',
  'txt',
  'json',
  'xml',
  'png',
  'jpg',
  'jpeg',
  'gif',
] as const;

export const FONT_FAMILIES = [
  { value: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', label: 'Inter (Default)' },
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: 'System Font' },
  { value: '"Roboto", sans-serif', label: 'Roboto' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: '"Lato", sans-serif', label: 'Lato' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
  { value: '"Source Sans Pro", sans-serif', label: 'Source Sans Pro' },
  { value: '"IBM Plex Sans", sans-serif', label: 'IBM Plex Sans' },
  { value: '"Arial", sans-serif', label: 'Arial' },
  { value: '"Helvetica Neue", Helvetica, sans-serif', label: 'Helvetica' },
] as const;