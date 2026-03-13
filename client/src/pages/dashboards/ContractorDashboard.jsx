import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import {
  DEFAULT_LAYOUTS, WidgetPicker, renderWidget,
} from '../../components/shared/DashboardWidgets';

export default function ContractorDashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const url = pid ? `/dashboard?project_id=${pid}` : '/dashboard';
  const { data, loading } = useApi(url);
  const [layout, setLayout] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    api.get('/dashboard/layout')
      .then(res => setLayout(res?.layout || DEFAULT_LAYOUTS.contractor))
      .catch(() => setLayout(DEFAULT_LAYOUTS.contractor));
  }, []);

  if (loading || !layout) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const { stats, materialRequests } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contractor Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage labor, materials, and tasks</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Active Stages" value={stats?.activeStages || 0} color="blue" />
          <StatCard label="Pending Materials" value={stats?.pendingMaterials || 0} color="yellow" />
          <StatCard label="Today's Labor" value={stats?.todayLabor || 0} sub="workers on-site" color="green" />
          <StatCard label="Assigned Tasks" value={stats?.assignedTasks || 0} color="indigo" />
          <StatCard label="In Progress" value={stats?.inProgressTasks || 0} color="blue" />
          <StatCard label="Completed Tasks" value={stats?.completedTasks || 0} color="green" />
        </div>
      )}

      {/* Material Requests — always show if present, since it's the contractor's primary view */}
      {materialRequests?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Material Requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Code</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Material</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Quantity</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Stage</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {materialRequests.map((req) => (
                  <tr key={req.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700">{req.request_code}</td>
                    <td className="py-2 px-3 text-slate-600">{req.material}</td>
                    <td className="py-2 px-3 text-slate-600">{req.quantity}</td>
                    <td className="py-2 px-3 text-slate-600">{req.stage_name || '-'}</td>
                    <td className="py-2 px-3"><Badge status={req.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Extra widgets from layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {layout.filter(id => id !== 'stat_cards' && id !== 'material_requests').map(widgetId => renderWidget(widgetId, data))}
      </div>

      {showPicker && (
        <WidgetPicker
          currentLayout={layout}
          role="contractor"
          onSave={(newLayout) => { setLayout(newLayout); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
