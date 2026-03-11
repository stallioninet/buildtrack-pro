import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useProject } from '../../context/ProjectContext';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';

export default function EngineerDashboard() {
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

  const { activeStage, substages, checklistProgress, stats } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Site Engineer Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Active stage monitoring and checklists</p>
      </div>

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
    </div>
  );
}
