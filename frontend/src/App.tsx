import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider, App as AntApp } from 'antd';
import { store } from './store';
import MainLayout from './components/Layout/MainLayout';
import ReportBuilder from './pages/ReportBuilder';
import ReportList from './pages/ReportList';
import ScheduleManager from './pages/ScheduleManager';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  console.log('App component rendering...');
  
  try {
    return (
      <Provider store={store}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#1890ff',
              borderRadius: 4,
            },
          }}
        >
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
                  <Route path="schedules" element={<ScheduleManager />} />
                  <Route path="admin" element={<AdminPanel />} />
                </Route>
              </Routes>
            </Router>
          </AntApp>
        </ConfigProvider>
      </Provider>
    );
  } catch (error) {
    console.error('App rendering error:', error);
    return <div>Error loading app: {String(error)}</div>;
  }
}

export default App
