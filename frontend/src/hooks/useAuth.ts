import { useState, useEffect } from 'react';

export const useAuth = () => {
  // For now, mock authentication - always authenticated in dev
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [user, setUser] = useState({
    id: 'mock-user',
    name: 'Demo User',
    email: 'demo@boe.local',
    role: 'admin',
  });

  useEffect(() => {
    // In production, this would check JWT token validity
    const token = localStorage.getItem('auth-token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login - accept any credentials for demo
    localStorage.setItem('auth-token', 'mock-jwt-token');
    setIsAuthenticated(true);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('auth-token');
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    user,
    login,
    logout,
  };
};