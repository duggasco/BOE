import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { App as AntApp } from 'antd';
import { store } from './store';
import { ThemeProvider } from './contexts/ThemeContext';
import { ViewportProvider } from './contexts/ViewportContext';
import MainLayout from './components/Layout/MainLayout';
import ReportBuilder from './pages/ReportBuilder';
import ReportList from './pages/ReportList';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
// Schedule components
import SchedulesIndex from './pages/Schedules';
import ScheduleList from './pages/Schedules/ScheduleList';
import ScheduleMonitor from './pages/Schedules/ScheduleMonitor';
import ScheduleHistory from './pages/Schedules/ScheduleHistory';
import TemplateManager from './pages/Schedules/TemplateManager';
import ScheduleWizard from './pages/Schedules/ScheduleWizard';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/common/ErrorBoundary';
import { loadSampleReports } from './data/sampleReports';
import ErrorTestComponent from './components/test/ErrorTestComponent';
import './App.css';
import './styles/theme.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  useEffect(() => {
    // Load sample reports on app initialization
    loadSampleReports();
  }, []);
  
  return (
    <ErrorBoundary>
        <Provider store={store}>
          <ThemeProvider>
            <ViewportProvider>
              <AntApp>
                <Router>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <MainLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/reports" />} />
                      <Route path="reports" element={<ReportList />} />
                      <Route path="reports/new" element={<ReportBuilder />} />
                      <Route path="reports/:id/edit" element={<ReportBuilder />} />
                      {/* Schedule Routes */}
                      <Route path="schedules" element={<ScheduleList />} />
                      <Route path="schedules/monitor" element={<ScheduleMonitor />} />
                      <Route path="schedules/history" element={<ScheduleHistory />} />
                      <Route path="schedules/:scheduleId/history" element={<ScheduleHistory />} />
                      <Route path="schedules/templates" element={<TemplateManager />} />
                      <Route path="schedules/new" element={<ScheduleWizard />} />
                      <Route path="schedules/:id/edit" element={<ScheduleWizard />} />
                      <Route path="admin" element={<AdminPanel />} />
                      <Route path="test-error" element={<ErrorTestComponent />} />
                    </Route>
                  </Routes>
                </Router>
              </AntApp>
            </ViewportProvider>
          </ThemeProvider>
        </Provider>
    </ErrorBoundary>
  );
}

export default App
