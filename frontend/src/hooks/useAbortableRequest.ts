import { useState, useEffect, useCallback, useRef } from 'react';

export interface RequestState<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isEmpty: boolean;
}

export interface RequestOptions {
  immediate?: boolean; // Execute immediately on mount
  retryCount?: number; // Number of retries on failure
  retryDelay?: number; // Delay between retries in ms
  cacheTime?: number; // Cache results for this many ms
  minLoadingTime?: number; // Minimum loading time to prevent flashing
  loadingDelayType?: 'none' | 'fast' | 'network'; // Progressive delay type
}

const LOADING_DELAYS = {
  none: 0,      // For cached data
  fast: 100,    // For fast operations
  network: 300, // For network requests
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Simple in-memory cache
const requestCache = new Map<string, CacheEntry<any>>();

export function useAbortableRequest<T = any>(
  requestFn: (signal: AbortSignal) => Promise<T>,
  dependencies: any[] = [],
  options: RequestOptions = {}
) {
  const {
    immediate = true,
    retryCount = 0,
    retryDelay = 1000,
    cacheTime = 0,
    minLoadingTime,
    loadingDelayType = 'network',
  } = options;

  const [state, setState] = useState<RequestState<T>>({
    data: null,
    loading: immediate,
    error: null,
    isEmpty: true,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingStartTimeRef = useRef<number>(0);
  const retriesRef = useRef(0);

  // Calculate actual minimum loading time based on type
  const actualMinLoadingTime = minLoadingTime ?? LOADING_DELAYS[loadingDelayType];

  // Generate cache key from dependencies
  const getCacheKey = useCallback(() => {
    return JSON.stringify(dependencies);
  }, [dependencies]);

  // Check cache
  const checkCache = useCallback((): T | null => {
    if (cacheTime <= 0) return null;
    
    const cacheKey = getCacheKey();
    const cached = requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
    
    return null;
  }, [cacheTime, getCacheKey]);

  // Save to cache
  const saveToCache = useCallback((data: T) => {
    if (cacheTime <= 0) return;
    
    const cacheKey = getCacheKey();
    requestCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }, [cacheTime, getCacheKey]);

  // Clean up old cache entries periodically
  useEffect(() => {
    if (cacheTime <= 0) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      requestCache.forEach((entry, key) => {
        if (now - entry.timestamp > cacheTime) {
          requestCache.delete(key);
        }
      });
    }, cacheTime * 2); // Clean up at 2x cache time
    
    return () => clearInterval(interval);
  }, [cacheTime]);

  const execute = useCallback(async () => {
    // Check cache first
    const cached = checkCache();
    if (cached !== null) {
      setState({
        data: cached,
        loading: false,
        error: null,
        isEmpty: Array.isArray(cached) ? cached.length === 0 : !cached,
      });
      return cached;
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Start loading
    loadingStartTimeRef.current = Date.now();
    setState(prev => ({ ...prev, loading: true, error: null }));
    retriesRef.current = 0;

    const attemptRequest = async (): Promise<T> => {
      try {
        const result = await requestFn(controller.signal);
        
        // Ensure minimum loading time
        const elapsedTime = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, actualMinLoadingTime - elapsedTime);
        
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        // Check if request was aborted during the delay
        if (controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        
        // Save to cache
        saveToCache(result);
        
        // Update state
        setState({
          data: result,
          loading: false,
          error: null,
          isEmpty: Array.isArray(result) ? result.length === 0 : !result,
        });
        
        return result;
      } catch (error: any) {
        // Don't retry on abort
        if (error.name === 'AbortError') {
          throw error;
        }
        
        // Retry logic
        if (retriesRef.current < retryCount) {
          retriesRef.current++;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return attemptRequest();
        }
        
        // Final error
        setState({
          data: null,
          loading: false,
          error: error as Error,
          isEmpty: true,
        });
        
        throw error;
      }
    };

    try {
      return await attemptRequest();
    } catch (error: any) {
      // Don't update state if aborted (component likely unmounted)
      if (error.name !== 'AbortError') {
        setState({
          data: null,
          loading: false,
          error: error as Error,
          isEmpty: true,
        });
      }
      throw error;
    }
  }, [requestFn, actualMinLoadingTime, checkCache, saveToCache, retryCount, retryDelay]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const reset = useCallback(() => {
    abort();
    setState({
      data: null,
      loading: false,
      error: null,
      isEmpty: true,
    });
  }, [abort]);

  const retry = useCallback(() => {
    retriesRef.current = 0;
    return execute();
  }, [execute]);

  // Execute on mount/dependencies change if immediate
  useEffect(() => {
    if (immediate) {
      execute().catch(() => {
        // Error already handled in state
      });
    }
    
    return () => {
      // Cleanup: abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    ...state,
    execute,
    abort,
    reset,
    retry,
    refetch: execute, // Alias for execute
  };
}