import type { ReportDefinition } from '../types';

export const sampleReports: ReportDefinition[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Fund Performance Dashboard',
    description: 'Comprehensive view of fund performance metrics with tables and charts',
    sections: [
      // Title section
      {
        id: 'header-123e4567-e89b-12d3-a456-426614174000',
        type: 'text',
        layout: { x: 0, y: 0, w: 12, h: 2, minH: 1, minW: 3 },
        textContent: '# Fund Performance Dashboard\n\n**Monthly Performance Review** - Updated: August 2025',
      },
      // Main performance table
      {
        id: 'table-223e4567-e89b-12d3-a456-426614174001',
        type: 'table',
        layout: { x: 0, y: 2, w: 12, h: 6, minH: 4, minW: 6 },
        dataQuery: {
          dimensions: [
            { id: 'fund_name', field: 'fundName', displayName: 'Fund Name', type: 'string' },
            { id: 'fund_type', field: 'fundType', displayName: 'Fund Type', type: 'string' },
            { id: 'manager', field: 'manager', displayName: 'Manager', type: 'string' },
          ],
          measures: [
            { id: 'total_assets', field: 'totalAssets', displayName: 'Total Assets', type: 'currency', aggregation: 'sum' },
            { id: 'return_1m', field: 'return1m', displayName: '1 Month Return', type: 'percentage', aggregation: 'avg' },
            { id: 'return_ytd', field: 'returnYtd', displayName: 'YTD Return', type: 'percentage', aggregation: 'avg' },
            { id: 'return_1y', field: 'return1y', displayName: '1 Year Return', type: 'percentage', aggregation: 'avg' },
          ],
          filters: [],
          sorting: [{ field: 'total_assets', direction: 'desc' }],
          limit: 10,
        },
        tableConfig: {
          showRowNumbers: true,
          enableSorting: true,
          enableFiltering: true,
          rowsPerPage: 10,
        },
      },
      // Performance by Fund Type Chart
      {
        id: 'chart-pie-323e4567-e89b-12d3-a456-426614174002',
        type: 'chart',
        layout: { x: 0, y: 8, w: 6, h: 5, minH: 3, minW: 4 },
        dataQuery: {
          dimensions: [
            { id: 'fund_type', field: 'fundType', displayName: 'Fund Type', type: 'string' },
          ],
          measures: [
            { id: 'total_assets', field: 'totalAssets', displayName: 'Total Assets', type: 'currency', aggregation: 'sum' },
          ],
          filters: [],
          sorting: [],
        },
        chartConfig: {
          chartType: 'pie',
          title: 'Assets by Fund Type',
          showLegend: true,
          dataLabels: true,
          xAxisField: 'fundType',
          yAxisField: 'totalAssets',
        },
      },
      // Monthly Returns Trend Chart
      {
        id: 'chart-line-423e4567-e89b-12d3-a456-426614174003',
        type: 'chart',
        layout: { x: 6, y: 8, w: 6, h: 5, minH: 3, minW: 4 },
        dataQuery: {
          dimensions: [
            { id: 'fund_name', field: 'fundName', displayName: 'Fund Name', type: 'string' },
          ],
          measures: [
            { id: 'return_1m', field: 'return1m', displayName: '1 Month', type: 'percentage', aggregation: 'avg' },
            { id: 'return_3m', field: 'return3m', displayName: '3 Month', type: 'percentage', aggregation: 'avg' },
            { id: 'return_6m', field: 'return6m', displayName: '6 Month', type: 'percentage', aggregation: 'avg' },
          ],
          filters: [],
          sorting: [{ field: 'return_1m', direction: 'desc' }],
          limit: 5,
        },
        chartConfig: {
          chartType: 'bar',
          title: 'Top 5 Funds - Period Returns',
          showLegend: true,
          dataLabels: false,
          xAxisField: 'fundName',
          yAxisField: 'return_1m',
          xAxisAngle: -45,
        },
      },
    ],
    filters: [],
    parameters: [],
    dataSources: [{ id: 'main', name: 'Fund Database', type: 'postgresql' }],
    createdAt: '2025-08-01T10:00:00.000Z',
    updatedAt: '2025-08-07T14:30:00.000Z',
    version: 1,
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    name: 'Top Performers Report',
    description: 'Identify and analyze top-performing funds with returns > 10%',
    sections: [
      // Header
      {
        id: 'header-523e4567-e89b-12d3-a456-426614174004',
        type: 'text',
        layout: { x: 0, y: 0, w: 12, h: 2, minH: 1, minW: 3 },
        textContent: '# Top Performers Report\n\n**Funds with 1-Year Returns > 10%**',
      },
      // Filtered Table
      {
        id: 'table-623e4567-e89b-12d3-a456-426614174005',
        type: 'table',
        layout: { x: 0, y: 2, w: 12, h: 6, minH: 4, minW: 6 },
        dataQuery: {
          dimensions: [
            { id: 'fund_name', field: 'fundName', displayName: 'Fund Name', type: 'string' },
            { id: 'category', field: 'category', displayName: 'Category', type: 'string' },
          ],
          measures: [
            { id: 'return_1y', field: 'return1y', displayName: '1 Year Return', type: 'percentage', aggregation: 'avg' },
            { id: 'total_assets', field: 'totalAssets', displayName: 'Total Assets', type: 'currency', aggregation: 'sum' },
            { id: 'expense_ratio', field: 'expenseRatio', displayName: 'Expense Ratio', type: 'percentage', aggregation: 'avg' },
          ],
          filters: [
            { field: 'return1y', operator: '>', value: 10, type: 'number' }
          ],
          sorting: [{ field: 'return_1y', direction: 'desc' }],
        },
        tableConfig: {
          showRowNumbers: true,
          enableSorting: true,
          enableFiltering: true,
          rowsPerPage: 15,
        },
      },
      // Distribution Chart
      {
        id: 'chart-pie-723e4567-e89b-12d3-a456-426614174006',
        type: 'chart',
        layout: { x: 0, y: 8, w: 6, h: 5, minH: 3, minW: 4 },
        dataQuery: {
          dimensions: [
            { id: 'fund_type', field: 'fundType', displayName: 'Fund Type', type: 'string' },
          ],
          measures: [
            { id: 'count', field: 'fundId', displayName: 'Count', type: 'number', aggregation: 'count' },
          ],
          filters: [
            { field: 'return1y', operator: '>', value: 10, type: 'number' }
          ],
          sorting: [],
        },
        chartConfig: {
          chartType: 'pie',
          title: 'Top Performers by Fund Type',
          showLegend: true,
          dataLabels: true,
          xAxisField: 'fundType',
          yAxisField: 'count',
        },
      },
      // Performance Bar Chart
      {
        id: 'chart-bar-823e4567-e89b-12d3-a456-426614174007',
        type: 'chart',
        layout: { x: 6, y: 8, w: 6, h: 5, minH: 3, minW: 4 },
        dataQuery: {
          dimensions: [
            { id: 'category', field: 'category', displayName: 'Category', type: 'string' },
          ],
          measures: [
            { id: 'avg_return', field: 'return1y', displayName: 'Avg Return', type: 'percentage', aggregation: 'avg' },
          ],
          filters: [
            { field: 'return1y', operator: '>', value: 10, type: 'number' }
          ],
          sorting: [{ field: 'avg_return', direction: 'desc' }],
          limit: 10,
        },
        chartConfig: {
          chartType: 'bar',
          title: 'Average Returns by Category',
          showLegend: false,
          dataLabels: true,
          xAxisField: 'category',
          yAxisField: 'avg_return',
          xAxisAngle: -45,
        },
      },
    ],
    filters: [],
    parameters: [],
    dataSources: [{ id: 'main', name: 'Fund Database', type: 'postgresql' }],
    createdAt: '2025-08-02T09:15:00.000Z',
    updatedAt: '2025-08-07T15:45:00.000Z',
    version: 1,
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-234567890123',
    name: 'Quick Overview Report',
    description: 'Simple report demonstrating key features',
    sections: [
      // Title
      {
        id: 'header-923e4567-e89b-12d3-a456-426614174008',
        type: 'text',
        layout: { x: 0, y: 0, w: 12, h: 2, minH: 1, minW: 3 },
        textContent: '# Quick Overview\n\nThis report demonstrates the key features of the BOE Replacement System.',
      },
      // Summary Table
      {
        id: 'table-a23e4567-e89b-12d3-a456-426614174009',
        type: 'table',
        layout: { x: 0, y: 2, w: 8, h: 5, minH: 3, minW: 4 },
        dataQuery: {
          dimensions: [
            { id: 'fund_name', field: 'fundName', displayName: 'Fund Name', type: 'string' },
            { id: 'manager', field: 'manager', displayName: 'Manager', type: 'string' },
          ],
          measures: [
            { id: 'total_assets', field: 'totalAssets', displayName: 'Total Assets', type: 'currency', aggregation: 'sum' },
            { id: 'return_ytd', field: 'returnYtd', displayName: 'YTD Return', type: 'percentage', aggregation: 'avg' },
          ],
          filters: [],
          sorting: [{ field: 'total_assets', direction: 'desc' }],
          limit: 5,
        },
        tableConfig: {
          showRowNumbers: false,
          enableSorting: true,
          enableFiltering: false,
          rowsPerPage: 5,
        },
      },
      // Simple Chart
      {
        id: 'chart-b23e4567-e89b-12d3-a456-426614174010',
        type: 'chart',
        layout: { x: 8, y: 2, w: 4, h: 5, minH: 3, minW: 3 },
        dataQuery: {
          dimensions: [
            { id: 'fund_type', field: 'fundType', displayName: 'Type', type: 'string' },
          ],
          measures: [
            { id: 'count', field: 'fundId', displayName: 'Count', type: 'number', aggregation: 'count' },
          ],
          filters: [],
          sorting: [],
        },
        chartConfig: {
          chartType: 'pie',
          title: 'Fund Distribution',
          showLegend: true,
          dataLabels: false,
          xAxisField: 'fundType',
          yAxisField: 'count',
        },
      },
      // Notes Section
      {
        id: 'notes-c23e4567-e89b-12d3-a456-426614174011',
        type: 'text',
        layout: { x: 0, y: 7, w: 12, h: 3, minH: 2, minW: 4 },
        textContent: '## Key Features Demonstrated\n\n- **Drag & Drop**: Fields can be dragged from the selector to create sections\n- **Multi-field Selection**: Use checkboxes to select multiple fields\n- **AG-Grid Tables**: Professional data grids with sorting and filtering\n- **Interactive Charts**: Line, Bar, Pie, and Area visualizations\n- **Export & Scheduling**: Configure automated delivery',
      },
    ],
    filters: [],
    parameters: [],
    dataSources: [{ id: 'main', name: 'Fund Database', type: 'postgresql' }],
    createdAt: '2025-08-03T11:20:00.000Z',
    updatedAt: '2025-08-07T16:00:00.000Z',
    version: 1,
  },
];

// Function to load sample reports into localStorage
export const loadSampleReports = () => {
  const existingReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
  
  // Check if sample reports already exist by ID
  const existingIds = new Set(existingReports.map((r: ReportDefinition) => r.id));
  const samplesToAdd = sampleReports.filter(report => !existingIds.has(report.id));
  
  if (samplesToAdd.length > 0) {
    // Add sample reports that don't exist
    const updatedReports = [...existingReports, ...samplesToAdd];
    localStorage.setItem('savedReports', JSON.stringify(updatedReports));
    return true;
  }
  
  return false;
};

// Function to get a specific sample report by name
export const getSampleReport = (name: string): ReportDefinition | undefined => {
  return sampleReports.find(r => r.name === name);
};