import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import { formatDate, statusColor } from '../../utils/formatters';
import {
  DEFAULT_LAYOUTS, WidgetPicker, renderWidget,
} from '../../components/shared/DashboardWidgets';

export default function PMDashboard() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const pid = currentProject?.id;
  const url = pid ? `/dashboard?project_id=${pid}` : '/dashboard';
  const { data, loading } = useApi(url);
  const [layout, setLayout] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // Load saved layout
  useEffect(() => {
    api.get('/dashboard/layout')
      .then(res => {
        if (res?.layout) setLayout(res.layout);
        else setLayout(DEFAULT_LAYOUTS.pm);
      })
      .catch(() => setLayout(DEFAULT_LAYOUTS.pm));
  }, []);

  if (loading || !layout) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Project Manager Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Track stages, resources, and quality</p>
        </div>
        <button onClick={() => setShowPicker(true)}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Customize
        </button>
      </div>

      {/* Stat cards — always shown if in layout */}
      {layout.includes('stat_cards') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Overall Progress" value={`${stats?.completion || 0}%`} sub={`${stats?.activeStages} active stages`} color="blue" />
          <StatCard label="Tasks" value={`${stats?.completedTasks || 0}/${stats?.totalTasks || 0}`} sub={`${stats?.highPriorityTasks || 0} high priority`} color="indigo" />
          <StatCard label="Pending Materials" value={stats?.pendingMaterials || 0} color="yellow" />
          <StatCard label="Open Defects" value={stats?.openDefects || 0} color="red" />
          <StatCard label="Today's Labor" value={stats?.todayLaborCount || 0} sub="workers on-site" color="green" />
          <StatCard label="Scheduled Inspections" value={stats?.scheduledInspections || 0} color="purple" />
        </div>
      )}

      {/* Render widgets from layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {layout.filter(id => id !== 'stat_cards').map(widgetId => renderWidget(widgetId, data))}
      </div>

      {showPicker && (
        <WidgetPicker
          currentLayout={layout}
          role="pm"
          onSave={(newLayout) => { setLayout(newLayout); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
