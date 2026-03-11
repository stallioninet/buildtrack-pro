import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useProject } from '../../context/ProjectContext';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';

export default function ProcurementDashboard() {
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

  const { stats, recentRequests, inventory } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Procurement Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Materials, vendors, and inventory</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Pending Requests" value={stats?.pendingRequests || 0} color="yellow" />
        <StatCard label="Active Vendors" value={stats?.activeVendors || 0} color="blue" />
        <StatCard label="Low Stock Items" value={stats?.lowStockItems || 0} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Requests</h3>
          <div className="space-y-3">
            {recentRequests?.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{req.request_code}</p>
                  <p className="text-xs text-slate-400">{req.material} - {req.quantity}</p>
                </div>
                <Badge status={req.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Inventory Overview</h3>
          <div className="space-y-3">
            {inventory?.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.material}</p>
                  <p className="text-xs text-slate-400">{item.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{item.stock} {item.unit}</p>
                  <p className="text-xs text-slate-400">of {item.total_inward} total</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
