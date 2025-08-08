import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { queryExecutor } from '../../services/queryExecutorWithAPI';
import type { QueryResult } from '../../services/queryExecutorWithAPI';
import type { DataQuery } from '../../types';

interface QueryState {
  results: Record<string, QueryResult>; // sectionId -> result
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  cache: {
    data: Record<string, { result: QueryResult; timestamp: number }>;
    ttl: number; // Cache TTL in milliseconds
  };
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const initialState: QueryState = {
  results: {},
  loading: {},
  errors: {},
  cache: {
    data: {},
    ttl: CACHE_TTL,
  },
};

// Async thunk for executing queries
export const executeQueryForSection = createAsyncThunk(
  'query/executeForSection',
  async ({ sectionId, query }: { sectionId: string; query: DataQuery }) => {
    const result = await queryExecutor.executeQuery(query);
    return { sectionId, result };
  }
);

// Async thunk for executing multiple queries with dependency resolution
export const executeQueriesWithDependencies = createAsyncThunk(
  'query/executeWithDependencies',
  async (sections: Array<{ id: string; dependencies?: string[]; dataQuery?: DataQuery }>) => {
    const executedQueries = new Map<string, QueryResult>();
    const executionOrder = await queryExecutor.resolveDependencies(sections, executedQueries);
    
    const results: Record<string, QueryResult> = {};
    executedQueries.forEach((result, sectionId) => {
      results[sectionId] = result;
    });
    
    return { results, executionOrder };
  }
);

const querySlice = createSlice({
  name: 'query',
  initialState,
  reducers: {
    clearResults: (state, action: PayloadAction<string>) => {
      delete state.results[action.payload];
      delete state.loading[action.payload];
      delete state.errors[action.payload];
    },
    
    clearAllResults: (state) => {
      state.results = {};
      state.loading = {};
      state.errors = {};
    },
    
    setCacheResult: (state, action: PayloadAction<{
      key: string;
      result: QueryResult;
    }>) => {
      state.cache.data[action.payload.key] = {
        result: action.payload.result,
        timestamp: Date.now(),
      };
    },
    
    clearExpiredCache: (state) => {
      const now = Date.now();
      Object.keys(state.cache.data).forEach(key => {
        if (now - state.cache.data[key].timestamp > state.cache.ttl) {
          delete state.cache.data[key];
        }
      });
    },
    
    updateCacheTTL: (state, action: PayloadAction<number>) => {
      state.cache.ttl = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Single query execution
      .addCase(executeQueryForSection.pending, (state, action) => {
        const sectionId = action.meta.arg.sectionId;
        state.loading[sectionId] = true;
        delete state.errors[sectionId];
      })
      .addCase(executeQueryForSection.fulfilled, (state, action) => {
        const { sectionId, result } = action.payload;
        state.results[sectionId] = result;
        state.loading[sectionId] = false;
        
        // Cache the result
        const cacheKey = JSON.stringify(action.meta.arg.query);
        state.cache.data[cacheKey] = {
          result,
          timestamp: Date.now(),
        };
      })
      .addCase(executeQueryForSection.rejected, (state, action) => {
        const sectionId = action.meta.arg.sectionId;
        state.loading[sectionId] = false;
        state.errors[sectionId] = action.error.message || 'Query execution failed';
      })
      
      // Multiple queries with dependencies
      .addCase(executeQueriesWithDependencies.pending, (state, action) => {
        action.meta.arg.forEach(section => {
          if (section.dataQuery) {
            state.loading[section.id] = true;
            delete state.errors[section.id];
          }
        });
      })
      .addCase(executeQueriesWithDependencies.fulfilled, (state, action) => {
        const { results } = action.payload;
        Object.entries(results).forEach(([sectionId, result]) => {
          state.results[sectionId] = result;
          state.loading[sectionId] = false;
        });
      })
      .addCase(executeQueriesWithDependencies.rejected, (state, action) => {
        action.meta.arg.forEach(section => {
          state.loading[section.id] = false;
          state.errors[section.id] = action.error.message || 'Query execution failed';
        });
      });
  },
});

export const {
  clearResults,
  clearAllResults,
  setCacheResult,
  clearExpiredCache,
  updateCacheTTL,
} = querySlice.actions;

export default querySlice.reducer;