import type { DataQuery, Field, Filter, FilterOperator } from '../types';
import { mockDatabase } from './mockData/fundData';
import type { Fund, FundPrice, FundReturn } from './mockData/fundData';

export interface QueryResult {
  data: any[];
  totalRows: number;
  executionTime: number;
  error?: string;
}

export class QueryExecutor {
  private static instance: QueryExecutor;
  
  private constructor() {}
  
  static getInstance(): QueryExecutor {
    if (!QueryExecutor.instance) {
      QueryExecutor.instance = new QueryExecutor();
    }
    return QueryExecutor.instance;
  }
  
  async executeQuery(query: DataQuery): Promise<QueryResult> {
    const startTime = performance.now();
    
    try {
      // For mock data, we'll simulate query execution
      let data = await this.fetchData(query.dataSourceId);
      
      // Apply filters
      if (query.filters.length > 0) {
        data = this.applyFilters(data, query.filters);
      }
      
      // Apply aggregations if measures are present
      if (query.measures.length > 0 || query.aggregations.length > 0) {
        data = this.applyAggregations(data, query);
      } else if (query.dimensions.length > 0) {
        // If only dimensions are selected (no measures), project the data to include only those fields
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
  
  private async fetchData(dataSourceId: string): Promise<any[]> {
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
        const value = this.getNestedValue(row, filter.fieldId);
        return this.evaluateFilter(value, filter);
      });
    });
  }
  
  private evaluateFilter(value: any, filter: Filter): boolean {
    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'notEquals':
        return value !== filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'notContains':
        return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'endsWith':
        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case 'greaterThan':
        return Number(value) > Number(filter.value);
      case 'greaterThanOrEqual':
        return Number(value) >= Number(filter.value);
      case 'lessThan':
        return Number(value) < Number(filter.value);
      case 'lessThanOrEqual':
        return Number(value) <= Number(filter.value);
      case 'between':
        return filter.values && Number(value) >= Number(filter.values[0]) && 
               Number(value) <= Number(filter.values[1]);
      case 'in':
        return filter.values?.includes(value);
      case 'notIn':
        return !filter.values?.includes(value);
      case 'isNull':
        return value == null;
      case 'isNotNull':
        return value != null;
      default:
        return true;
    }
  }
  
  private projectDimensions(data: any[], dimensions: Field[]): any[] {
    // Project data to only include the specified dimension fields
    return data.map(row => {
      const projectedRow: any = {};
      dimensions.forEach(dim => {
        projectedRow[dim.fieldId] = this.getNestedValue(row, dim.fieldId);
      });
      return projectedRow;
    });
  }
  
  private applyAggregations(data: any[], query: DataQuery): any[] {
    if (query.dimensions.length === 0) {
      // No grouping, aggregate all data
      return [this.aggregateGroup(data, query)];
    }
    
    // Group by dimensions
    const groups = this.groupBy(data, query.dimensions);
    
    // Aggregate each group
    return Object.entries(groups).map(([key, group]) => {
      const aggregated = this.aggregateGroup(group, query);
      
      // Add dimension values
      query.dimensions.forEach((dim, index) => {
        const dimKey = key.split('|')[index];
        aggregated[dim.fieldId] = dimKey === 'null' ? null : dimKey;
      });
      
      return aggregated;
    });
  }
  
  private groupBy(data: any[], dimensions: Field[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    data.forEach(row => {
      const key = dimensions
        .map(dim => String(this.getNestedValue(row, dim.fieldId) ?? 'null'))
        .join('|');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });
    
    return groups;
  }
  
  private aggregateGroup(group: any[], query: DataQuery): any {
    const result: any = {};
    
    // Apply measure aggregations
    query.measures.forEach(measure => {
      const values = group.map(row => this.getNestedValue(row, measure.fieldId))
        .filter(v => v != null && !isNaN(Number(v)));
      
      const aggregation = measure.aggregation || 'sum';
      result[measure.fieldId] = this.calculateAggregation(values, aggregation);
    });
    
    // Apply explicit aggregations
    query.aggregations.forEach(agg => {
      const values = group.map(row => this.getNestedValue(row, agg.fieldId))
        .filter(v => v != null);
      
      const alias = agg.alias || `${agg.fieldId}_${agg.function}`;
      result[alias] = this.calculateAggregation(values, agg.function);
    });
    
    return result;
  }
  
  private calculateAggregation(values: any[], func: string): any {
    if (values.length === 0) return null;
    
    switch (func) {
      case 'sum':
        return values.reduce((a, b) => Number(a) + Number(b), 0);
      case 'avg':
        return values.reduce((a, b) => Number(a) + Number(b), 0) / values.length;
      case 'count':
        return values.length;
      case 'min':
        return Math.min(...values.map(Number));
      case 'max':
        return Math.max(...values.map(Number));
      case 'distinct':
        return new Set(values).size;
      default:
        return values[0];
    }
  }
  
  private applySorting(data: any[], sorts: DataQuery['sorts']): any[] {
    return [...data].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = this.getNestedValue(a, sort.fieldId);
        const bVal = this.getNestedValue(b, sort.fieldId);
        
        let comparison = 0;
        if (aVal == null && bVal == null) comparison = 0;
        else if (aVal == null) comparison = 1;
        else if (bVal == null) comparison = -1;
        else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  // Dependency resolution for inter-section queries
  async resolveDependencies(
    sections: Array<{ id: string; dependencies?: string[]; dataQuery?: DataQuery }>,
    executedQueries: Map<string, QueryResult>
  ): Promise<string[]> {
    const resolved: Set<string> = new Set();
    const visited: Set<string> = new Set();
    
    const resolve = async (sectionId: string) => {
      if (visited.has(sectionId)) {
        // Check for circular dependency
        if (!resolved.has(sectionId)) {
          throw new Error(`Circular dependency detected for section ${sectionId}`);
        }
        return;
      }
      
      visited.add(sectionId);
      const section = sections.find(s => s.id === sectionId);
      
      if (!section) return;
      
      // Resolve dependencies first
      if (section.dependencies) {
        for (const depId of section.dependencies) {
          await resolve(depId);
        }
      }
      
      // Execute query if not already executed
      if (section.dataQuery && !executedQueries.has(sectionId)) {
        const result = await this.executeQuery(section.dataQuery);
        executedQueries.set(sectionId, result);
      }
      
      resolved.add(sectionId);
    };
    
    // Resolve all sections
    for (const section of sections) {
      await resolve(section.id);
    }
    
    return Array.from(resolved);
  }
}

export const queryExecutor = QueryExecutor.getInstance();