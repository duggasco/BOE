/**
 * API Client with Axios Interceptors
 * Handles authentication, token refresh, and error handling
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Base URL - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api/v1';

// Token storage keys
const ACCESS_TOKEN_KEY = 'boe_access_token';
const REFRESH_TOKEN_KEY = 'boe_refresh_token';
const TOKEN_EXPIRY_KEY = 'boe_token_expiry';

// Token management functions
export const tokenManager = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  getTokenExpiry: (): number | null => {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  },
  
  setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (expiresIn) {
      const expiryTime = Date.now() + (expiresIn * 1000); // Convert to milliseconds
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }
  },
  
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  },
  
  isTokenExpired: (): boolean => {
    const expiry = tokenManager.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() >= expiry;
  }
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();
    
    // Add token to header if it exists
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }
    
    return config;
  },
  (error: AxiosError) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh and errors
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.url}`, response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = tokenManager.getRefreshToken();
      
      if (refreshToken) {
        try {
          // Attempt to refresh the token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
          
          // Update stored tokens
          tokenManager.setTokens(access_token, newRefreshToken, expires_in);
          
          // Update authorization header
          if (apiClient.defaults.headers) {
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          }
          
          // Retry all queued requests
          onTokenRefreshed(access_token);
          
          // Retry the original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed - redirect to login
          console.error('[Token Refresh Failed]', refreshError);
          tokenManager.clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token - redirect to login
        tokenManager.clearTokens();
        window.location.href = '/login';
      }
    }
    
    // Handle other errors
    if (error.response) {
      // Server responded with error status
      console.error('[API Error]', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url
      });
      
      // Format error message
      const errorMessage = error.response.data?.detail || 
                          error.response.data?.message || 
                          `Request failed with status ${error.response.status}`;
      
      // Create a more descriptive error
      const enhancedError = new Error(errorMessage) as Error & { 
        status?: number; 
        data?: any; 
        originalError?: AxiosError;
      };
      enhancedError.status = error.response.status;
      enhancedError.data = error.response.data;
      enhancedError.originalError = error;
      
      return Promise.reject(enhancedError);
    } else if (error.request) {
      // Request made but no response received
      console.error('[API No Response]', error.request);
      const networkError = new Error('Network error - please check your connection');
      return Promise.reject(networkError);
    } else {
      // Error in request setup
      console.error('[API Setup Error]', error.message);
      return Promise.reject(error);
    }
  }
);

// Export the configured client
export default apiClient;

// Export typed API methods
export const api = {
  get: <T = any>(url: string, config?: any) => 
    apiClient.get<T>(url, config).then(res => res.data),
  
  post: <T = any>(url: string, data?: any, config?: any) => 
    apiClient.post<T>(url, data, config).then(res => res.data),
  
  put: <T = any>(url: string, data?: any, config?: any) => 
    apiClient.put<T>(url, data, config).then(res => res.data),
  
  patch: <T = any>(url: string, data?: any, config?: any) => 
    apiClient.patch<T>(url, data, config).then(res => res.data),
  
  delete: <T = any>(url: string, config?: any) => 
    apiClient.delete<T>(url, config).then(res => res.data),
};