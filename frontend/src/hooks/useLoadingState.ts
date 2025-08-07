import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingStateOptions {
  initialLoading?: boolean;
  minLoadingTime?: number; // Minimum time to show loading state (prevents flashing)
  onError?: (error: Error) => void;
}

interface LoadingState<T = any> {
  loading: boolean;
  error: Error | null;
  data: T | null;
  isEmpty: boolean;
}

interface LoadingStateActions<T = any> {
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setData: (data: T | null) => void;
  reset: () => void;
  execute: (asyncFunction: () => Promise<T>) => Promise<T | undefined>;
}

export function useLoadingState<T = any>(
  options: LoadingStateOptions = {}
): [LoadingState<T>, LoadingStateActions<T>] {
  const {
    initialLoading = false,
    minLoadingTime = 300,
    onError,
  } = options;

  const [state, setState] = useState<LoadingState<T>>({
    loading: initialLoading,
    error: null,
    data: null,
    isEmpty: true,
  });

  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    if (!isMountedRef.current) return;
    
    if (loading) {
      // Start loading immediately
      setState(prev => ({ ...prev, loading: true, error: null }));
    } else {
      // Ensure minimum loading time to prevent flashing
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      loadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setState(prev => ({ ...prev, loading: false }));
        }
      }, minLoadingTime);
    }
  }, [minLoadingTime]);

  const setError = useCallback((error: Error | null) => {
    if (!isMountedRef.current) return;
    
    setState(prev => ({ ...prev, error, loading: false }));
    
    if (error && onError) {
      onError(error);
    }
  }, [onError]);

  const setData = useCallback((data: T | null) => {
    if (!isMountedRef.current) return;
    
    const isEmpty = !data || (Array.isArray(data) && data.length === 0);
    setState(prev => ({ ...prev, data, isEmpty, loading: false, error: null }));
  }, []);

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setState({
      loading: false,
      error: null,
      data: null,
      isEmpty: true,
    });
  }, []);

  const execute = useCallback(async (asyncFunction: () => Promise<T>): Promise<T | undefined> => {
    const startTime = Date.now();
    setLoading(true);
    
    try {
      const result = await asyncFunction();
      
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      
      if (isMountedRef.current) {
        setData(result);
        return result;
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError(error as Error);
      }
      throw error;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [setLoading, setData, setError, minLoadingTime]);

  return [
    state,
    {
      setLoading,
      setError,
      setData,
      reset,
      execute,
    },
  ];
}

// Specialized version for API calls
export function useApiLoadingState<T = any>(
  apiCall?: () => Promise<T>,
  dependencies: any[] = []
) {
  const [state, actions] = useLoadingState<T>({
    initialLoading: !!apiCall,
    minLoadingTime: 500,
  });

  useEffect(() => {
    if (apiCall) {
      actions.execute(apiCall).catch(() => {
        // Error already handled in the hook
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const refetch = useCallback(() => {
    if (apiCall) {
      return actions.execute(apiCall);
    }
    return Promise.resolve(undefined);
  }, [apiCall, actions]);

  return {
    ...state,
    ...actions,
    refetch,
  };
}