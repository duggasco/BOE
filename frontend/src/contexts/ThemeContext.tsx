import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  actualTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getActualTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
};

interface ThemeProviderProps {
  children: ReactNode;
}

// Validate theme mode from localStorage
const isValidThemeMode = (value: string | null): value is ThemeMode => {
  return value === 'light' || value === 'dark' || value === 'system';
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    return isValidThemeMode(saved) ? saved : 'system';
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => 
    getActualTheme(mode)
  );

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setActualTheme(e.matches ? 'dark' : 'light');
    };

    // Use the newer addEventListener with options for better cleanup
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [mode]);

  // Update actual theme when mode changes
  useEffect(() => {
    const newActualTheme = getActualTheme(mode);
    setActualTheme(newActualTheme);
    
    // Update document classes and meta tags
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newActualTheme);
    document.documentElement.setAttribute('data-theme', newActualTheme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', newActualTheme === 'dark' ? '#0f1419' : '#ffffff');
    }
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme-mode', newMode);
  };

  const toggleTheme = () => {
    const newMode = actualTheme === 'light' ? 'dark' : 'light';
    setMode(newMode);
  };

  // Configure Ant Design theme
  const antTheme = {
    algorithm: actualTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 4,
      ...(actualTheme === 'dark' ? {
        colorBgContainer: '#1a1f2e',
        colorBgElevated: '#0f1419',
        colorBgLayout: '#0a0d13',
        colorText: '#e8e8e8',
        colorTextSecondary: '#a8a8a8',
        colorBorder: '#303640',
        colorBorderSecondary: '#1f232b',
      } : {
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f0f2f5',
        colorText: '#000000',
        colorTextSecondary: '#595959',
        colorBorder: '#d9d9d9',
        colorBorderSecondary: '#f0f0f0',
      })
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, actualTheme, setMode, toggleTheme }}>
      <ConfigProvider theme={antTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};