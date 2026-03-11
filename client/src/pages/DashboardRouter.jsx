import { useAuth } from '../context/AuthContext';
import OwnerDashboard from './dashboards/OwnerDashboard';
import PMDashboard from './dashboards/PMDashboard';
import EngineerDashboard from './dashboards/EngineerDashboard';
import ContractorDashboard from './dashboards/ContractorDashboard';
import ProcurementDashboard from './dashboards/ProcurementDashboard';
import AccountsDashboard from './dashboards/AccountsDashboard';
import InspectorDashboard from './dashboards/InspectorDashboard';

const DASHBOARD_MAP = {
  owner: OwnerDashboard,
  pm: PMDashboard,
  engineer: EngineerDashboard,
  contractor: ContractorDashboard,
  procurement: ProcurementDashboard,
  accounts: AccountsDashboard,
  inspector: InspectorDashboard,
};

export default function DashboardRouter() {
  const { user } = useAuth();
  const Dashboard = DASHBOARD_MAP[user?.role] || OwnerDashboard;
  return <Dashboard />;
}
