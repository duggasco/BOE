import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ViewportContextType {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

const ViewportContext = createContext<ViewportContextType | undefined>(undefined);

// Breakpoint constants - single source of truth
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

interface ViewportProviderProps {
  children: ReactNode;
}

// Debounce function for performance
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export const ViewportProvider: React.FC<ViewportProviderProps> = ({ children }) => {
  const getViewportData = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < BREAKPOINTS.mobile;
    const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.tablet;
    
    let breakpoint: 'mobile' | 'tablet' | 'desktop';
    if (isMobile) {
      breakpoint = 'mobile';
    } else if (isTablet) {
      breakpoint = 'tablet';
    } else {
      breakpoint = 'desktop';
    }
    
    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      breakpoint,
    };
  };

  const [viewport, setViewport] = useState<ViewportContextType>(getViewportData);

  useEffect(() => {
    // Debounced resize handler for performance
    const handleResize = debounce(() => {
      setViewport(getViewportData());
    }, 150); // 150ms debounce delay

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Initial call to set viewport
    handleResize();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <ViewportContext.Provider value={viewport}>
      {children}
    </ViewportContext.Provider>
  );
};

// Custom hook to use viewport context
export const useViewport = (): ViewportContextType => {
  const context = useContext(ViewportContext);
  if (context === undefined) {
    throw new Error('useViewport must be used within a ViewportProvider');
  }
  return context;
};

// Utility hook for common viewport queries
export const useResponsive = () => {
  const viewport = useViewport();
  
  return {
    ...viewport,
    isMobileOrTablet: viewport.isMobile || viewport.isTablet,
    isTabletOrDesktop: viewport.isTablet || viewport.isDesktop,
  };
};