import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  DEFAULT_LAYOUTS, WidgetPicker, renderWidget,
} from '../../components/shared/DashboardWidgets';

export default function AccountsDashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const url = pid ? `/dashboard?project_id=${pid}` : '/dashboard';
  const { data, loading } = useApi(url);
  const [layout, setLayout] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    api.get('/dashboard/layout')
      .then(res => setLayout(res?.layout || DEFAULT_LAYOUTS.accounts))
      .catch(() => setLayout(DEFAULT_LAYOUTS.accounts));
  }, []);

  if (loading || !layout) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Accounts Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Financial overview and approvals</p>
        </div>
        <button onClick={() => setShowPicker(true)}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Customize
        </button>
      </div>

      {layout.includes('stat_cards') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Budget" value={formatCurrency(stats?.totalBudget)} color="blue" />
          <StatCard label="Total Spent" value={formatCurrency(stats?.totalSpent)} color="green" />
          <StatCard label="Budget Remaining" value={formatCurrency((stats?.totalBudget || 0) - (stats?.totalSpent || 0))} color="purple" />
          <StatCard label="Total Expenses" value={formatCurrency(stats?.totalExpenses)} color="orange" />
          <StatCard label="Pending Payments" value={stats?.pendingPayments || 0} color="yellow" />
          <StatCard label="Pending Expenses" value={stats?.pendingExpenses || 0} color="red" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {layout.filter(id => id !== 'stat_cards').map(widgetId => renderWidget(widgetId, data))}
      </div>

      {showPicker && (
        <WidgetPicker
          currentLayout={layout}
          role="accounts"
          onSave={(newLayout) => { setLayout(newLayout); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
