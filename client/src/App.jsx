import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';

const DashboardRouter = lazy(() => import('./pages/DashboardRouter'));
const StagesPage = lazy(() => import('./pages/StagesPage'));
const StageDetailPage = lazy(() => import('./pages/StageDetailPage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const VendorsPage = lazy(() => import('./pages/VendorsPage'));
const QualityPage = lazy(() => import('./pages/QualityPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const DailyLogsPage = lazy(() => import('./pages/DailyLogsPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const BudgetPage = lazy(() => import('./pages/BudgetPage'));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'));
const DefectsPage = lazy(() => import('./pages/DefectsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const NCRsPage = lazy(() => import('./pages/NCRsPage'));
const RFIsPage = lazy(() => import('./pages/RFIsPage'));
const ChangeOrdersPage = lazy(() => import('./pages/ChangeOrdersPage'));
const SafetyPage = lazy(() => import('./pages/SafetyPage'));
const RABillsPage = lazy(() => import('./pages/RABillsPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const EstimatorPage = lazy(() => import('./pages/EstimatorPage'));
const RatesMasterPage = lazy(() => import('./pages/RatesMasterPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const SubmittalsPage = lazy(() => import('./pages/SubmittalsPage'));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'));
const PunchListPage = lazy(() => import('./pages/PunchListPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DrawingViewerPage = lazy(() => import('./pages/DrawingViewerPage'));
const ActivityFeedPage = lazy(() => import('./pages/ActivityFeedPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const BidsPage = lazy(() => import('./pages/BidsPage'));
const SOVPage = lazy(() => import('./pages/SOVPage'));

const PageSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-slate-500 text-sm mb-6">An unexpected error occurred. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-500 text-sm">Loading BuildTrack Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/stages" element={<StagesPage />} />
          <Route path="/stages/:id" element={<StageDetailPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/quality" element={<QualityPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/daily-logs" element={<DailyLogsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/ncrs" element={<NCRsPage />} />
          <Route path="/rfis" element={<RFIsPage />} />
          <Route path="/change-orders" element={<ChangeOrdersPage />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/ra-bills" element={<RABillsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/defects" element={<DefectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/estimator" element={<EstimatorPage />} />
          <Route path="/rates-master" element={<RatesMasterPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/submittals" element={<SubmittalsPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
          <Route path="/punch-lists" element={<PunchListPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/documents/:id/viewer" element={<DrawingViewerPage />} />
          <Route path="/activity" element={<ActivityFeedPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/bids" element={<BidsPage />} />
          <Route path="/sov" element={<SOVPage />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
