/**
 * Query Executor with API Integration
 * Switches between mock data and real API based on configuration
 */

import type { DataQuery, Field, Filter, FilterOperator } from '../types';
import { mockDatabase } from './mockData/fundData';
import { queryService } from './api/queryService';
import type { Fund, FundPrice, FundReturn } from './mockData/fundData';

export interface QueryResult {
  data: any[];
  totalRows: number;
  executionTime: number;
  error?: string;
  columns?: Array<{
    name: string;
    type: string;
    displayName: string;
  }>;
}

export class QueryExecutorWithAPI {
  private static instance: QueryExecutorWithAPI;
  private useAPI: boolean;
  
  private constructor() {
    // Check if we should use the API or mock data
    this.useAPI = process.env.REACT_APP_USE_API === 'true' || 
                  window.location.hostname !== 'localhost';
  }
  
  static getInstance(): QueryExecutorWithAPI {
    if (!QueryExecutorWithAPI.instance) {
      QueryExecutorWithAPI.instance = new QueryExecutorWithAPI();
    }
    return QueryExecutorWithAPI.instance;
  }
  
  /**
   * Set whether to use API or mock data
   */
  setUseAPI(useAPI: boolean): void {
    this.useAPI = useAPI;
  }
  
  /**
   * Execute a query using either API or mock data
   */
  async executeQuery(query: DataQuery): Promise<QueryResult> {
    if (this.useAPI) {
      try {
        // Use the real API
        const result = await queryService.executeDataQuery(query);
        return {
          data: result.data,
          totalRows: result.totalRows,
          executionTime: result.executionTime,
          columns: result.columns
        };
      } catch (error) {
        console.error('API query failed, falling back to mock data:', error);
        // Fall back to mock data if API fails
        return this.executeMockQuery(query);
      }
    } else {
      // Use mock data
      return this.executeMockQuery(query);
    }
  }
  
  /**
   * Execute query using mock data (original implementation)
   */
  private async executeMockQuery(query: DataQuery): Promise<QueryResult> {
    const startTime = performance.now();
    
    try {
      // For mock data, we'll simulate query execution
      let data = await this.fetchMockData(query.dataSourceId);
      
      // Apply filters
      if (query.filters.length > 0) {
        data = this.applyFilters(data, query.filters);
      }
      
      // Apply aggregations if measures are present
      if (query.measures.length > 0 || query.aggregations.length > 0) {
        data = this.applyAggregations(data, query);
      } else if (query.dimensions.length > 0) {
        // If only dimensions are selected (no measures), project the data
        data = this.projectDimensions(data, query.dimensions);
      }
      
      // Apply sorting
      if (query.sorts.length > 0) {
        data = this.applySorting(data, query.sorts);
      }
      
      // Apply pagination
      const totalRows = data.length;
      if (query.limit) {
        const offset = query.offset || 0;
        data = data.slice(offset, offset + query.limit);
      }
      
      const executionTime = performance.now() - startTime;
      
      return {
        data,
        totalRows,
        executionTime,
      };
    } catch (error) {
      return {
        data: [],
        totalRows: 0,
        executionTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Query execution failed',
      };
    }
  }
  
  private async fetchMockData(dataSourceId: string): Promise<any[]> {
    // Simulate async data fetching
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (dataSourceId === 'mock-funds') {
      // Combine fund data with latest prices and returns
      const funds = mockDatabase.getFunds();
      const latestPrices = mockDatabase.getLatestPrices();
      
      return funds.map(fund => {
        const price = latestPrices.find(p => p.fundId === fund.fundId);
        const returns = mockDatabase.getReturns(fund.fundId);
        const latestReturn = returns[0];
        
        return {
          ...fund,
          currentNav: price?.nav || 0,
          dayChange: price?.dayChange || 0,
          dayChangePercent: price?.dayChangePercent || 0,
          return1m: latestReturn?.return1m || 0,
          return3m: latestReturn?.return3m || 0,
          return1y: latestReturn?.return1y || 0,
          returnYtd: latestReturn?.returnYtd || 0,
        };
      });
    }
    
    throw new Error(`Unknown data source: ${dataSourceId}`);
  }
  
  private applyFilters(data: any[], filters: Filter[]): any[] {
    return data.filter(row => {
      return filters.every(filter => {
        const value = row[filter.field];
        const filterValue = filter.value;
        
        switch (filter.operator) {
          case 'equals':
            return value === filterValue;
          case 'not_equals':
            return value !== filterValue;
          case 'contains':
            return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
          case 'starts_with':
            return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
          case 'ends_with':
            return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
          case 'greater_than':
            return Number(value) > Number(filterValue);
          case 'less_than':
            return Number(value) < Number(filterValue);
          case 'greater_than_or_equal':
            return Number(value) >= Number(filterValue);
          case 'less_than_or_equal':
            return Number(value) <= Number(filterValue);
          case 'between':
            if (Array.isArray(filterValue) && filterValue.length === 2) {
              return value >= filterValue[0] && value <= filterValue[1];
            }
            return false;
          case 'in':
            return Array.isArray(filterValue) && filterValue.includes(value);
          case 'not_in':
            return Array.isArray(filterValue) && !filterValue.includes(value);
          case 'is_null':
            return value === null || value === undefined;
          case 'is_not_null':
            return value !== null && value !== undefined;
          default:
            return true;
        }
      });
    });
  }
  
  private applyAggregations(data: any[], query: DataQuery): any[] {
    if (query.dimensions.length === 0) {
      // No grouping, aggregate all data
      return [this.aggregateRows(data, query)];
    }
    
    // Group by dimensions
    const groups = new Map<string, any[]>();
    
    data.forEach(row => {
      const key = query.dimensions.map(dim => row[dim.fieldName]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });
    
    // Aggregate each group
    const result: any[] = [];
    groups.forEach((groupRows, key) => {
      const aggregated = this.aggregateRows(groupRows, query);
      
      // Add dimension values
      const keyParts = key.split('|');
      query.dimensions.forEach((dim, index) => {
        aggregated[dim.fieldName] = keyParts[index];
      });
      
      result.push(aggregated);
    });
    
    return result;
  }
  
  private aggregateRows(rows: any[], query: DataQuery): any {
    const result: any = {};
    
    // Apply measure aggregations
    query.measures.forEach(measure => {
      const values = rows.map(row => row[measure.fieldName]).filter(v => v !== null && v !== undefined);
      
      switch (measure.aggregation) {
        case 'sum':
          result[measure.fieldName] = values.reduce((sum, val) => sum + Number(val), 0);
          break;
        case 'avg':
          result[measure.fieldName] = values.length > 0 
            ? values.reduce((sum, val) => sum + Number(val), 0) / values.length 
            : 0;
          break;
        case 'count':
          result[measure.fieldName] = values.length;
          break;
        case 'min':
          result[measure.fieldName] = values.length > 0 ? Math.min(...values.map(Number)) : null;
          break;
        case 'max':
          result[measure.fieldName] = values.length > 0 ? Math.max(...values.map(Number)) : null;
          break;
        default:
          result[measure.fieldName] = values[0];
      }
    });
    
    return result;
  }
  
  private projectDimensions(data: any[], dimensions: Field[]): any[] {
    return data.map(row => {
      const projected: any = {};
      dimensions.forEach(dim => {
        projected[dim.fieldName] = row[dim.fieldName];
      });
      return projected;
    });
  }
  
  private applySorting(data: any[], sorts: Array<{ fieldId: string; direction: string }>): any[] {
    return [...data].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a[sort.fieldId];
        const bVal = b[sort.fieldId];
        
        let comparison = 0;
        if (aVal === null || aVal === undefined) comparison = 1;
        else if (bVal === null || bVal === undefined) comparison = -1;
        else if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }
  
  /**
   * Resolve query dependencies for sections
   */
  async resolveDependencies(
    sections: Array<{ id: string; dependencies?: string[]; dataQuery?: DataQuery }>,
    executedQueries: Map<string, QueryResult>
  ): Promise<string[]> {
    const executionOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = async (sectionId: string) => {
      if (visited.has(sectionId)) return;
      if (visiting.has(sectionId)) {
        throw new Error(`Circular dependency detected for section ${sectionId}`);
      }
      
      visiting.add(sectionId);
      
      const section = sections.find(s => s.id === sectionId);
      if (section?.dependencies) {
        for (const depId of section.dependencies) {
          await visit(depId);
        }
      }
      
      visiting.delete(sectionId);
      visited.add(sectionId);
      
      // Execute query for this section
      if (section?.dataQuery) {
        const result = await this.executeQuery(section.dataQuery);
        executedQueries.set(sectionId, result);
      }
      
      executionOrder.push(sectionId);
    };
    
    for (const section of sections) {
      await visit(section.id);
    }
    
    return executionOrder;
  }
  
  /**
   * Validate a query before execution
   */
  async validateQuery(query: DataQuery): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for required fields
    if (query.dimensions.length === 0 && query.measures.length === 0) {
      errors.push('Query must have at least one dimension or measure');
    }
    
    // Check for valid data source
    if (!query.dataSourceId) {
      errors.push('Data source is required');
    }
    
    // Validate filters
    query.filters.forEach((filter, index) => {
      if (!filter.field) {
        errors.push(`Filter ${index + 1}: Field is required`);
      }
      if (!filter.operator) {
        errors.push(`Filter ${index + 1}: Operator is required`);
      }
    });
    
    // Add warnings for performance
    if (query.limit && query.limit > 10000) {
      warnings.push('Large result sets may impact performance');
    }
    
    if (query.dimensions.length > 5) {
      warnings.push('Many grouping dimensions may result in a large number of groups');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

// Export singleton instance
export const queryExecutor = QueryExecutorWithAPI.getInstance();