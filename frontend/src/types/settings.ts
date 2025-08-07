export interface DataSource {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'snowflake';
  host: string;
  port: number;
  database: string;
  username: string;
  isActive: boolean;
  connectionPool: {
    min: number;
    max: number;
    idleTimeout: number;
  };
  ssl: boolean;
  testStatus?: 'success' | 'failed' | 'testing';
  lastTested?: string;
}

export interface GlobalSettings {
  system: {
    companyName: string;
    systemName: string;
    timeZone: string;
    dateFormat: string;
    language: string;
    maxUploadSize: number;
    sessionTimeout: number;
    maintenanceMode: boolean;
    maintenanceMessage?: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpSecure: boolean;
    fromAddress: string;
    fromName: string;
    replyTo: string;
  };
  storage: {
    type: 'local' | 's3' | 'azure' | 'gcs';
    path?: string;
    bucket?: string;
    region?: string;
    maxFileSize: number;
    allowedExtensions: string[];
  };
  security: {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecial: boolean;
    passwordExpireDays: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    mfaRequired: boolean;
    ipWhitelist: string[];
  };
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  rolloutPercentage?: number;
  targetGroups?: string[];
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
  fontFamily: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
}