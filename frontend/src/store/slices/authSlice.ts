/**
 * Authentication Redux Slice
 * Manages authentication state globally
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import authService from '../../services/api/authService';
import { tokenManager } from '../../services/api/client';
import type { User, LoginCredentials, RegisterData } from '../../services/api/authService';

// State interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpired: boolean;
  loginRedirect: string | null;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: tokenManager.getAccessToken() !== null,
  isLoading: false,
  error: null,
  sessionExpired: false,
  loginRedirect: null,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const user = await authService.login(credentials);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (data: RegisterData, { rejectWithValue }) => {
    try {
      const user = await authService.register(data);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Registration failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error: any) {
      // Even if logout API fails, we'll clear local state
      console.error('Logout API error:', error);
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch user');
    }
  }
);

// Create slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Set session expired flag
    setSessionExpired: (state, action: PayloadAction<boolean>) => {
      state.sessionExpired = action.payload;
      if (action.payload) {
        state.isAuthenticated = false;
        state.user = null;
      }
    },
    
    // Set login redirect path
    setLoginRedirect: (state, action: PayloadAction<string | null>) => {
      state.loginRedirect = action.payload;
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    
    // Update user
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    
    // Check authentication status
    checkAuth: (state) => {
      const token = tokenManager.getAccessToken();
      state.isAuthenticated = !!token && !tokenManager.isTokenExpired();
      
      if (!state.isAuthenticated) {
        state.user = null;
      }
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.sessionExpired = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
      });
    
    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        // After registration, user needs to login
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.sessionExpired = false;
        state.error = null;
        state.loginRedirect = null;
      })
      .addCase(logout.rejected, (state) => {
        // Even if API fails, clear local state
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.sessionExpired = false;
        state.error = null;
        state.loginRedirect = null;
      });
    
    // Fetch current user
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.sessionExpired = false;
        state.error = null;
        authService.setCachedUser(action.payload);
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // If fetching user fails, user might not be authenticated
        if (action.payload === 'Unauthorized') {
          state.isAuthenticated = false;
          state.user = null;
        }
      });
  },
});

// Export actions
export const {
  setSessionExpired,
  setLoginRedirect,
  clearError,
  updateUser,
  checkAuth,
} = authSlice.actions;

// Selectors
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectError = (state: { auth: AuthState }) => state.auth.error;
export const selectSessionExpired = (state: { auth: AuthState }) => state.auth.sessionExpired;
export const selectLoginRedirect = (state: { auth: AuthState }) => state.auth.loginRedirect;

// Permission selectors
export const selectHasPermission = (resource: string, action: string) => 
  (state: { auth: AuthState }) => {
    if (!state.auth.user) return false;
    return authService.hasPermission(resource, action);
  };

export const selectHasRole = (roleName: string) =>
  (state: { auth: AuthState }) => {
    if (!state.auth.user) return false;
    return authService.hasRole(roleName);
  };

// Export reducer
export default authSlice.reducer;