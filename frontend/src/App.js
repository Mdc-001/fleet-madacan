import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import ApprovalDashboard from './pages/ApprovalDashboard';
import VehiclePage from './pages/VehiclePage';
import JobDetailPage from './pages/JobDetailPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardAnalytics from './pages/DashboardAnalytics';
import SyncJobs from './pages/SyncJobs';
import VerificatorDashboard from './pages/VerificatorDashboard';
import WarehouseDashboard from './pages/WarehouseDashboard';
import MaintenanceFollowUp from './pages/MaintenanceFollowUp';
import SCMDashboard from './pages/SCMDashboard';

function App() {
  return (
    <Routes>
      {/* Root always shows login page */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>}
      />
      <Route
        path="/user"
        element={<ProtectedRoute allowedRoles={['User', 'Scm']}><UserDashboard /></ProtectedRoute>}
      />
      <Route
        path="/approval"
        element={<ProtectedRoute allowedRoles={['Approval']}><ApprovalDashboard /></ProtectedRoute>}
      />
      <Route
        path="/dashboard-analytics"
        element={<ProtectedRoute allowedRoles={['Admin', 'User', 'verificator', 'Scm']}><DashboardAnalytics /></ProtectedRoute>}
      />
      <Route
        path="/sync-jobs"
        element={<ProtectedRoute allowedRoles={['Admin']}><SyncJobs /></ProtectedRoute>}
      />
      <Route
        path="/vehicle/:vehicleId"
        element={<ProtectedRoute allowedRoles={['Admin', 'User', 'Approval', 'verificator', 'Scm']}><VehiclePage /></ProtectedRoute>}
      />
      <Route
        path="/vehicle/:vehicleId/job/:jobId"
        element={<ProtectedRoute allowedRoles={['Admin', 'User', 'Approval', 'verificator', 'Scm']}><JobDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/verificator-dashboard"
        element={<ProtectedRoute allowedRoles={['verificator']}><VerificatorDashboard /></ProtectedRoute>}
      />
      <Route
        path="/maintenance-follow-up"
        element={<ProtectedRoute allowedRoles={['Admin', 'User', 'Scm']}><MaintenanceFollowUp /></ProtectedRoute>}
      />
      <Route
        path="/warehouse-dashboard"
        element={<ProtectedRoute allowedRoles={['Admin', 'User', 'Approval', 'verificator', 'storeroom', 'Scm']}><WarehouseDashboard /></ProtectedRoute>}
      />
      <Route
        path="/scm"
        element={<ProtectedRoute allowedRoles={['Scm']}><SCMDashboard /></ProtectedRoute>}
      />

      {/* Fallback route */}
      <Route path="*" element={<p>Page not found</p>} />
    </Routes>
  );
}

export default App;
