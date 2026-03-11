import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useProject } from '../../context/ProjectContext';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function AccountsDashboard() {
  const { currentProject } = useProject();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = currentProject?.id;
    const url = pid ? `/dashboard?project_id=${pid}` : '/dashboard';
    setLoading(true);
    api.get(url).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const { stats, recentExpenses, recentPayments } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Accounts Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Financial overview and approvals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Budget" value={formatCurrency(stats?.totalBudget)} color="blue" />
        <StatCard label="Total Spent" value={formatCurrency(stats?.totalSpent)} color="green" />
        <StatCard label="Budget Remaining" value={formatCurrency((stats?.totalBudget || 0) - (stats?.totalSpent || 0))} color="purple" />
        <StatCard label="Total Expenses" value={formatCurrency(stats?.totalExpenses)} color="orange" />
        <StatCard label="Pending Payments" value={stats?.pendingPayments || 0} color="yellow" />
        <StatCard label="Pending Expenses" value={stats?.pendingExpenses || 0} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Expenses</h3>
          <div className="space-y-3">
            {recentExpenses?.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{exp.category}</p>
                  <p className="text-xs text-slate-400">{exp.description} | {formatDate(exp.expense_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(exp.amount)}</p>
                  <Badge status={exp.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {recentPayments?.map((pay) => (
              <div key={pay.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{pay.payment_code}</p>
                  <p className="text-xs text-slate-400">{pay.vendor_name} | {pay.stage_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(pay.amount)}</p>
                  <Badge status={pay.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
