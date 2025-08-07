import type { DataSource, GlobalSettings, FeatureFlag, ThemeSettings } from '../types/settings';

// Mock data for Phase 2 - will be replaced with actual API calls in Phase 3
const mockDataSources: DataSource[] = [
  {
    id: 'ds1',
    name: 'Production Database',
    type: 'postgresql',
    host: 'prod-db.example.com',
    port: 5432,
    database: 'boe_prod',
    username: 'boe_user',
    isActive: true,
    connectionPool: { min: 5, max: 20, idleTimeout: 30000 },
    ssl: true,
    testStatus: 'success',
    lastTested: '2025-01-07T10:30:00Z',
  },
  {
    id: 'ds2',
    name: 'Analytics Warehouse',
    type: 'snowflake',
    host: 'analytics.snowflakecomputing.com',
    port: 443,
    database: 'ANALYTICS_WH',
    username: 'analytics_user',
    isActive: true,
    connectionPool: { min: 2, max: 10, idleTimeout: 60000 },
    ssl: true,
    testStatus: 'success',
    lastTested: '2025-01-07T09:15:00Z',
  },
];

const mockGlobalSettings: GlobalSettings = {
  system: {
    companyName: 'Acme Corporation',
    systemName: 'BOE Replacement System',
    timeZone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    language: 'en-US',
    maxUploadSize: 100,
    sessionTimeout: 30,
    maintenanceMode: false,
    maintenanceMessage: '',
  },
  email: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: 'notifications@example.com',
    smtpSecure: true,
    fromAddress: 'no-reply@example.com',
    fromName: 'BOE System',
    replyTo: 'support@example.com',
  },
  storage: {
    type: 's3',
    bucket: 'boe-reports',
    region: 'us-east-1',
    maxFileSize: 500,
    allowedExtensions: ['pdf', 'csv', 'xlsx', 'docx'],
  },
  security: {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecial: true,
    passwordExpireDays: 90,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    mfaRequired: false,
    ipWhitelist: [],
  },
};

const mockFeatureFlags: FeatureFlag[] = [
  {
    id: 'ff1',
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Enable advanced analytics features including predictive models',
    enabled: true,
    category: 'Analytics',
  },
  {
    id: 'ff2',
    key: 'export_to_cloud',
    name: 'Cloud Export',
    description: 'Allow exports directly to cloud storage providers',
    enabled: true,
    category: 'Export',
  },
  {
    id: 'ff3',
    key: 'ai_assistant',
    name: 'AI Assistant',
    description: 'Enable AI-powered report generation assistant',
    enabled: false,
    category: 'AI',
    rolloutPercentage: 25,
  },
  {
    id: 'ff4',
    key: 'real_time_collab',
    name: 'Real-time Collaboration',
    description: 'Enable multiple users to edit reports simultaneously',
    enabled: false,
    category: 'Collaboration',
  },
];

const mockThemeSettings: ThemeSettings = {
  primaryColor: '#1677ff',
  secondaryColor: '#52c41a',
  backgroundColor: '#f0f2f5',
  textColor: '#000000',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.ico',
};

// Settings API service
export const settingsApi = {
  // Data Sources
  async getDataSources(): Promise<DataSource[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...mockDataSources];
  },

  async createDataSource(dataSource: Omit<DataSource, 'id' | 'testStatus' | 'lastTested'>): Promise<DataSource> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newDataSource: DataSource = {
      ...dataSource,
      id: `ds${Date.now()}`,
      testStatus: undefined,
    };
    mockDataSources.push(newDataSource);
    return newDataSource;
  },

  async updateDataSource(id: string, updates: Partial<DataSource>): Promise<DataSource> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = mockDataSources.findIndex(ds => ds.id === id);
    if (index === -1) throw new Error('Data source not found');
    
    mockDataSources[index] = { ...mockDataSources[index], ...updates };
    return mockDataSources[index];
  },

  async deleteDataSource(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = mockDataSources.findIndex(ds => ds.id === id);
    if (index === -1) throw new Error('Data source not found');
    
    mockDataSources.splice(index, 1);
  },

  async testDataSourceConnection(id: string): Promise<{ success: boolean; message: string }> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const success = Math.random() > 0.2;
    
    const index = mockDataSources.findIndex(ds => ds.id === id);
    if (index !== -1) {
      mockDataSources[index].testStatus = success ? 'success' : 'failed';
      mockDataSources[index].lastTested = new Date().toISOString();
    }
    
    return {
      success,
      message: success ? 'Connection successful' : 'Connection failed: Unable to reach host',
    };
  },

  // Global Settings
  async getGlobalSettings(): Promise<GlobalSettings> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { ...mockGlobalSettings };
  },

  async updateGlobalSettings(settings: GlobalSettings): Promise<GlobalSettings> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    Object.assign(mockGlobalSettings, settings);
    return { ...mockGlobalSettings };
  },

  // Feature Flags
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...mockFeatureFlags];
  },

  async toggleFeatureFlag(id: string): Promise<FeatureFlag> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const flag = mockFeatureFlags.find(f => f.id === id);
    if (!flag) throw new Error('Feature flag not found');
    
    flag.enabled = !flag.enabled;
    return { ...flag };
  },

  async updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = mockFeatureFlags.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Feature flag not found');
    
    mockFeatureFlags[index] = { ...mockFeatureFlags[index], ...updates };
    return mockFeatureFlags[index];
  },

  // Theme Settings
  async getThemeSettings(): Promise<ThemeSettings> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { ...mockThemeSettings };
  },

  async updateThemeSettings(settings: ThemeSettings): Promise<ThemeSettings> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    Object.assign(mockThemeSettings, settings);
    
    // In a real app, this would apply the theme
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', settings.primaryColor);
      root.style.setProperty('--secondary-color', settings.secondaryColor);
      root.style.setProperty('--background-color', settings.backgroundColor);
      root.style.setProperty('--text-color', settings.textColor);
      root.style.setProperty('--border-radius', `${settings.borderRadius}px`);
      root.style.setProperty('--font-size', `${settings.fontSize}px`);
      root.style.setProperty('--font-family', settings.fontFamily);
    }
    
    return { ...mockThemeSettings };
  },

  // Validate IP Address
  validateIPAddress(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || cidrRegex.test(ip);
  },

  // Sanitize CSS
  sanitizeCSS(css: string): string {
    // Basic CSS sanitization - in production, use a proper CSS sanitizer library
    const dangerousProperties = [
      'javascript:',
      'expression(',
      'behavior:',
      'binding:',
      '-moz-binding:',
      'import',
      '@import',
      'url(',
    ];
    
    let sanitized = css;
    dangerousProperties.forEach(prop => {
      const regex = new RegExp(prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      sanitized = sanitized.replace(regex, '');
    });
    
    return sanitized;
  },
};