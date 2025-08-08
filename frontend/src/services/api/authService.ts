/**
 * Authentication Service
 * Handles login, logout, registration, and user management
 */

import { api, tokenManager } from './client';

// Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  department?: string;
  job_title?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  department?: string;
  job_title?: string;
  phone?: string;
  last_login?: string;
  mfa_enabled: boolean;
  roles?: Role[];
  groups?: Group[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

class AuthService {
  private currentUser: User | null = null;

  /**
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      // Format data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      formData.append('grant_type', 'password');

      const response = await api.post<AuthResponse>('/auth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Store tokens
      tokenManager.setTokens(
        response.access_token,
        response.refresh_token,
        response.expires_in
      );

      // Get user details
      const user = await this.getCurrentUser();
      this.currentUser = user;

      return user;
    } catch (error: any) {
      console.error('[Login Error]', error);
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<User> {
    try {
      const user = await api.post<User>('/auth/register', data);
      return user;
    } catch (error: any) {
      console.error('[Registration Error]', error);
      if (error.status === 400) {
        throw new Error('Email already registered');
      }
      throw new Error(error.message || 'Registration failed');
    }
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to blacklist token
      await api.post('/auth/logout');
    } catch (error) {
      console.error('[Logout Error]', error);
    } finally {
      // Clear local tokens regardless of API response
      tokenManager.clearTokens();
      this.currentUser = null;
      
      // Redirect to login
      window.location.href = '/login';
    }
  }

  /**
   * Get current user details
   */
  async getCurrentUser(): Promise<User> {
    try {
      if (this.currentUser) {
        return this.currentUser;
      }

      const user = await api.get<User>('/auth/me');
      this.currentUser = user;
      return user;
    } catch (error: any) {
      console.error('[Get Current User Error]', error);
      throw new Error(error.message || 'Failed to get user details');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = tokenManager.getAccessToken();
    if (!token) return false;
    
    // Check if token is expired
    if (tokenManager.isTokenExpired()) {
      // Token expired - will be refreshed by interceptor
      return true; // Still return true as refresh might succeed
    }
    
    return true;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(resource: string, action: string): boolean {
    if (!this.currentUser) return false;
    
    // Superuser has all permissions
    if (this.currentUser.is_superuser) return true;
    
    // Check role permissions
    if (this.currentUser.roles) {
      for (const role of this.currentUser.roles) {
        // System roles might have implicit permissions
        if (role.is_system) {
          if (role.name === 'admin') return true;
          if (role.name === 'creator' && resource === 'reports' && 
              ['create', 'read', 'update'].includes(action)) return true;
          if (role.name === 'viewer' && action === 'read') return true;
        }
      }
    }
    
    // Check group permissions
    if (this.currentUser.groups) {
      for (const group of this.currentUser.groups) {
        if (group.permissions) {
          const hasPermission = group.permissions.some(
            p => p.resource === resource && p.action === action
          );
          if (hasPermission) return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if user has a specific role
   */
  hasRole(roleName: string): boolean {
    if (!this.currentUser) return false;
    
    if (this.currentUser.is_superuser) return true;
    
    return this.currentUser.roles?.some(role => role.name === roleName) || false;
  }

  /**
   * Get cached current user (without API call)
   */
  getCachedUser(): User | null {
    return this.currentUser;
  }

  /**
   * Update cached user
   */
  setCachedUser(user: User): void {
    this.currentUser = user;
  }

  /**
   * Clear cached user
   */
  clearCachedUser(): void {
    this.currentUser = null;
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export default
export default authService;