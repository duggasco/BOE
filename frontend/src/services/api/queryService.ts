/**
 * Query Service - API Integration
 * Handles query execution through the backend API
 */

import { apiClient } from './client';
import type { DataQuery, Field, Filter } from '../../types';

export interface QueryRequest {
  reportId?: string;
  fields: string[]; // Field IDs
  filters?: Filter[];
  groupBy?: string[];
  orderBy?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
  format?: 'json' | 'csv';
}

export interface QueryResult {
  data: any[];
  columns: Array<{
    name: string;
    type: string;
    displayName: string;
  }>;
  totalRows: number;
  executionTime: number;
  cached: boolean;
  queryId?: string;
}

export interface QueryValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  estimatedRows?: number;
  estimatedTime?: number;
}

class QueryService {
  private baseUrl = '/query';

  /**
   * Execute a query
   */
  async executeQuery(request: QueryRequest): Promise<QueryResult> {
    const response = await apiClient.post<QueryResult>(
      `${this.baseUrl}/execute`,
      request
    );
    return response.data;
  }

  /**
   * Execute a query from a DataQuery object (frontend format)
   */
  async executeDataQuery(query: DataQuery): Promise<QueryResult> {
    // Convert DataQuery to QueryRequest format
    const request: QueryRequest = {
      fields: [
        ...query.dimensions.map(d => d.id),
        ...query.measures.map(m => m.id)
      ],
      filters: query.filters,
      groupBy: query.dimensions.length > 0 ? query.dimensions.map(d => d.id) : undefined,
      orderBy: query.sorts.map(s => ({
        field: s.fieldId,
        direction: s.direction as 'ASC' | 'DESC'
      })),
      limit: query.limit,
      offset: query.offset
    };

    return this.executeQuery(request);
  }

  /**
   * Get a preview of query results (limited rows)
   */
  async previewQuery(request: QueryRequest): Promise<QueryResult> {
    const response = await apiClient.post<QueryResult>(
      `${this.baseUrl}/preview`,
      { ...request, limit: Math.min(request.limit || 100, 100) }
    );
    return response.data;
  }

  /**
   * Validate a query before execution
   */
  async validateQuery(request: QueryRequest): Promise<QueryValidationResult> {
    const response = await apiClient.post<QueryValidationResult>(
      `${this.baseUrl}/validate`,
      request
    );
    return response.data;
  }

  /**
   * Get query results by ID (for cached/saved queries)
   */
  async getQueryResults(queryId: string): Promise<QueryResult> {
    const response = await apiClient.get<QueryResult>(
      `${this.baseUrl}/results/${queryId}`
    );
    return response.data;
  }

  /**
   * Stream query results via WebSocket
   */
  streamQuery(
    request: QueryRequest,
    onData: (data: any[]) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.REACT_APP_API_URL?.replace(/^https?:\/\//, '') || window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/v1/query/stream`);

    ws.onopen = () => {
      ws.send(JSON.stringify(request));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'data') {
          onData(message.data);
        } else if (message.type === 'complete') {
          onComplete();
          ws.close();
        } else if (message.type === 'error') {
          onError(new Error(message.message));
          ws.close();
        }
      } catch (error) {
        onError(error as Error);
        ws.close();
      }
    };

    ws.onerror = (error) => {
      onError(new Error('WebSocket connection failed'));
    };

    return ws;
  }

  /**
   * Cancel a running query
   */
  async cancelQuery(queryId: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/cancel/${queryId}`);
  }

  /**
   * Get query execution history
   */
  async getQueryHistory(
    reportId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    items: Array<{
      id: string;
      reportId: string;
      query: QueryRequest;
      status: 'pending' | 'running' | 'completed' | 'failed';
      startedAt: string;
      completedAt?: string;
      rowCount?: number;
      executionTime?: number;
      error?: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    if (reportId) {
      params.append('reportId', reportId);
    }

    const response = await apiClient.get(
      `${this.baseUrl}/history?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get query execution plan (for optimization)
   */
  async getQueryPlan(request: QueryRequest): Promise<{
    plan: string;
    estimatedCost: number;
    estimatedRows: number;
    warnings?: string[];
  }> {
    const response = await apiClient.post(
      `${this.baseUrl}/explain`,
      request
    );
    return response.data;
  }

  /**
   * Export query results
   */
  async exportQueryResults(
    request: QueryRequest,
    format: 'csv' | 'excel' | 'pdf'
  ): Promise<{
    exportId: string;
    status: 'pending' | 'processing' | 'completed';
    downloadUrl?: string;
  }> {
    const response = await apiClient.post(
      `${this.baseUrl}/export`,
      { ...request, format }
    );
    return response.data;
  }
}

// Export singleton instance
export const queryService = new QueryService();