import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useProject } from '../../context/ProjectContext';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';

export default function ContractorDashboard() {
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

  const { stats, materialRequests, stages } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Contractor Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Manage labor, materials, and tasks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active Stages" value={stats?.activeStages || 0} color="blue" />
        <StatCard label="Pending Materials" value={stats?.pendingMaterials || 0} color="yellow" />
        <StatCard label="Today's Labor" value={stats?.todayLabor || 0} sub="workers on-site" color="green" />
        <StatCard label="Assigned Tasks" value={stats?.assignedTasks || 0} color="indigo" />
        <StatCard label="In Progress" value={stats?.inProgressTasks || 0} color="blue" />
        <StatCard label="Completed Tasks" value={stats?.completedTasks || 0} color="green" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Material Requests</h3>
        {materialRequests?.length > 0 ? (
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
        ) : (
          <p className="text-sm text-slate-400">No material requests</p>
        )}
      </div>
    </div>
  );
}
