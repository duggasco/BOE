export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  sections: ReportSection[];
  filters: GlobalFilter[];
  parameters: Parameter[];
  dataSources: DataSource[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ReportSection {
  id: string;
  type: 'table' | 'chart' | 'text' | 'container' | 'pivot';
  layout: GridLayout;
  dataQuery?: DataQuery;
  formatting?: Formatting;
  chartConfig?: ChartConfig; // Configuration for chart sections
  tableConfig?: TableConfig; // Configuration for table sections
  textContent?: string; // Content for text sections
  children?: ReportSection[]; // For nested sections
  parentId?: string;
  dependencies?: string[]; // IDs of sections this depends on
}

export interface GridLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export interface DataQuery {
  dataSourceId: string;
  dimensions: Field[];
  measures: Field[];
  filters: Filter[];
  sorts: Sort[];
  aggregations: Aggregation[];
  limit?: number;
  offset?: number;
}

export interface Field {
  fieldId: string;
  displayName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  aggregation?: 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  format?: FieldFormat;
  calculated?: boolean;
  formula?: string;
  semanticType?: 'currency' | 'percentage' | 'quantity' | 'identifier' | 'metric' | 'dimension';
  unit?: string; // e.g., 'USD', '%', 'units'
  metadata?: Record<string, any>;
}

export interface Filter {
  fieldId: string;
  operator: FilterOperator;
  value: any;
  values?: any[];
  isParameter?: boolean;
  parameterId?: string;
}

export type FilterOperator = 
  | 'equals' 
  | 'notEquals' 
  | 'contains' 
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull';

export interface GlobalFilter extends Filter {
  id: string;
  name: string;
  applyToSections?: string[]; // If empty, applies to all
}

export interface Sort {
  fieldId: string;
  direction: 'asc' | 'desc';
}

export interface Aggregation {
  fieldId: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  alias?: string;
}

export interface Parameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'dateRange' | 'list';
  defaultValue?: any;
  required: boolean;
  allowMultiple?: boolean;
  options?: ParameterOption[];
}

export interface ParameterOption {
  label: string;
  value: any;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mock' | 'database' | 'api' | 'file';
  connectionString?: string;
  tables?: string[];
  fields?: Field[];
}

export interface Formatting {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  padding?: number;
  border?: BorderStyle;
  conditionalFormatting?: ConditionalFormat[];
}

export interface BorderStyle {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface ConditionalFormat {
  condition: {
    field: string;
    operator: FilterOperator;
    value: any;
  };
  style: Partial<Formatting>;
}

export interface FieldFormat {
  type: 'number' | 'currency' | 'percentage' | 'date' | 'custom';
  decimals?: number;
  prefix?: string;
  suffix?: string;
  thousandsSeparator?: boolean;
  dateFormat?: string;
  customFormat?: string;
}

// Chart-specific types
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'combo';

export interface ChartConfig {
  type: ChartType;
  xAxis?: AxisConfig | string; // Can be field name or full config
  yAxis?: AxisConfig | string[]; // Can be field names or full config
  legend?: LegendConfig | boolean; // Can be boolean or full config
  colors?: string[];
  stacked?: boolean;
  showDataLabels?: boolean;
  lineType?: 'monotone' | 'linear' | 'step'; // For line charts
  xAxisRotation?: number; // For bar/line charts label rotation
  title?: string; // Chart title
}

export interface AxisConfig {
  field: string;
  label?: string;
  min?: number;
  max?: number;
  format?: FieldFormat;
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Table-specific types
export interface TableConfig {
  columns: TableColumn[];
  showRowNumbers?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  pageSize?: number;
  totals?: TotalRow[];
}

export interface TableColumn {
  fieldId: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: FieldFormat;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
}

export interface TotalRow {
  label: string;
  calculations: {
    fieldId: string;
    function: 'sum' | 'avg' | 'count' | 'min' | 'max';
  }[];
}