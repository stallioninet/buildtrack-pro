import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useProject } from '../../context/ProjectContext';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { formatDate, statusColor } from '../../utils/formatters';

export default function PMDashboard() {
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

  const { stages, stats, upcomingInspections, recentTasks } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Project Manager Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Track stages, resources, and quality</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Overall Progress" value={`${stats?.completion || 0}%`} sub={`${stats?.activeStages} active stages`} color="blue" />
        <StatCard label="Tasks" value={`${stats?.completedTasks || 0}/${stats?.totalTasks || 0}`} sub={`${stats?.highPriorityTasks || 0} high priority`} color="indigo" />
        <StatCard label="Pending Materials" value={stats?.pendingMaterials || 0} color="yellow" />
        <StatCard label="Open Defects" value={stats?.openDefects || 0} color="red" />
        <StatCard label="Today's Labor" value={stats?.todayLaborCount || 0} sub="workers on-site" color="green" />
        <StatCard label="Scheduled Inspections" value={stats?.scheduledInspections || 0} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stages */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Stage Progress</h3>
          <div className="space-y-3">
            {stages?.map((stage) => (
              <div key={stage.id} className="py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{stage.name}</span>
                  <Badge status={stage.status} />
                </div>
                <ProgressBar value={stage.completion} />
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming inspections */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Upcoming Inspections</h3>
          {upcomingInspections?.length > 0 ? (
            <div className="space-y-3">
              {upcomingInspections.map((insp) => (
                <div key={insp.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{insp.inspection_code}</p>
                    <p className="text-xs text-slate-400">{insp.stage_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">{formatDate(insp.inspection_date)}</p>
                    <Badge status={insp.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No upcoming inspections</p>
          )}
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Recent Tasks</h3>
          <Link to="/tasks" className="text-sm text-blue-600 hover:text-blue-800">View All</Link>
        </div>
        {recentTasks?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Code</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Title</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Stage</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Assigned To</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700">{task.task_code}</td>
                    <td className="py-2 px-3 text-slate-600">{task.title}</td>
                    <td className="py-2 px-3 text-slate-600">{task.stage_name}</td>
                    <td className="py-2 px-3 text-slate-600">{task.assigned_to_name || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No tasks yet</p>
        )}
      </div>
    </div>
  );
}
