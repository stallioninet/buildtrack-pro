import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import {
  DEFAULT_LAYOUTS, WidgetPicker, renderWidget,
} from '../../components/shared/DashboardWidgets';

export default function EngineerDashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const url = pid ? `/dashboard?project_id=${pid}` : '/dashboard';
  const { data, loading } = useApi(url);
  const [layout, setLayout] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    api.get('/dashboard/layout')
      .then(res => setLayout(res?.layout || DEFAULT_LAYOUTS.engineer))
      .catch(() => setLayout(DEFAULT_LAYOUTS.engineer));
  }, []);

  if (loading || !layout) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const { activeStage, substages, checklistProgress, stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Site Engineer Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Active stage monitoring and checklists</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Labor" value={stats?.todayLabor || 0} sub="workers on-site" color="blue" />
          <StatCard label="Open Defects" value={stats?.openDefects || 0} color="red" />
          <StatCard
            label="Checklist Progress"
            value={checklistProgress ? `${checklistProgress.checked}/${checklistProgress.total}` : '0/0'}
            sub="items completed"
            color="green"
          />
          <StatCard label="Tasks" value={`${stats?.inProgressTasks || 0} in progress`} sub={`${stats?.totalTasks || 0} total`} color="indigo" />
        </div>
      )}

      {activeStage ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Active Stage: {activeStage.name}</h3>
            <Badge status={activeStage.status} />
          </div>
          <ProgressBar value={activeStage.completion} className="mb-6" />

          <h4 className="text-sm font-medium text-slate-600 mb-3">Sub-stages</h4>
          <div className="space-y-3">
            {substages?.map((sub) => (
              <div key={sub.id} className="py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{sub.substage_order}. {sub.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{sub.completion}%</span>
                    <Badge status={sub.status} />
                  </div>
                </div>
                <ProgressBar value={sub.completion} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
          No active stage at the moment
        </div>
      )}

      {/* Render extra widgets from layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {layout.filter(id => id !== 'stat_cards' && id !== 'checklist_progress').map(widgetId => renderWidget(widgetId, data))}
      </div>

      {showPicker && (
        <WidgetPicker
          currentLayout={layout}
          role="engineer"
          onSave={(newLayout) => { setLayout(newLayout); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
