import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardRouter from './pages/DashboardRouter';
import StagesPage from './pages/StagesPage';
import StageDetailPage from './pages/StageDetailPage';
import MaterialsPage from './pages/MaterialsPage';
import VendorsPage from './pages/VendorsPage';
import QualityPage from './pages/QualityPage';
import ExpensesPage from './pages/ExpensesPage';
import PaymentsPage from './pages/PaymentsPage';
import InventoryPage from './pages/InventoryPage';
import DailyLogsPage from './pages/DailyLogsPage';
import AuditLogPage from './pages/AuditLogPage';
import BudgetPage from './pages/BudgetPage';
import WorkflowsPage from './pages/WorkflowsPage';
import DefectsPage from './pages/DefectsPage';
import ReportsPage from './pages/ReportsPage';
import TasksPage from './pages/TasksPage';
import NCRsPage from './pages/NCRsPage';
import RFIsPage from './pages/RFIsPage';
import ChangeOrdersPage from './pages/ChangeOrdersPage';
import SafetyPage from './pages/SafetyPage';
import RABillsPage from './pages/RABillsPage';
import DocumentsPage from './pages/DocumentsPage';
import EstimatorPage from './pages/EstimatorPage';
import RatesMasterPage from './pages/RatesMasterPage';
import TeamPage from './pages/TeamPage';
import ProjectsPage from './pages/ProjectsPage';
import SubmittalsPage from './pages/SubmittalsPage';
import MeetingsPage from './pages/MeetingsPage';

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
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

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
      </Route>

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
