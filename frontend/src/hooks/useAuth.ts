/**
 * useAuth Hook
 * Provides authentication state and methods from Redux
 */

import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import type { AppDispatch } from '../store';
import {
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
  login as loginAction,
  logout as logoutAction,
  fetchCurrentUser,
  clearError,
} from '../store/slices/authSlice';
import authService from '../services/api/authService';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Select auth state from Redux
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      await dispatch(loginAction({ 
        username: email, 
        password 
      })).unwrap();
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err as string 
      };
    }
  }, [dispatch]);

  // Logout function
  const logout = useCallback(async () => {
    await dispatch(logoutAction());
  }, [dispatch]);

  // Fetch current user
  const refreshUser = useCallback(async () => {
    try {
      await dispatch(fetchCurrentUser()).unwrap();
      return true;
    } catch {
      return false;
    }
  }, [dispatch]);

  // Clear error
  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Check permission
  const hasPermission = useCallback((resource: string, action: string) => {
    return authService.hasPermission(resource, action);
  }, []);

  // Check role
  const hasRole = useCallback((roleName: string) => {
    return authService.hasRole(roleName);
  }, []);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // Methods
    login,
    logout,
    refreshUser,
    clearAuthError,
    hasPermission,
    hasRole,
  };
};