import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useProject } from '../../context/ProjectContext';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatters';
import { DEFECT_SEVERITY_COLORS as SEVERITY_COLORS } from '../../config/constants';
import { DEFAULT_LAYOUTS, WidgetPicker } from '../../components/shared/DashboardWidgets';

export default function InspectorDashboard() {
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [recentInsp, setRecentInsp] = useState([]);
  const [recentDefects, setRecentDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    api.get('/dashboard/layout')
      .then(res => setLayout(res?.layout || DEFAULT_LAYOUTS.inspector))
      .catch(() => setLayout(DEFAULT_LAYOUTS.inspector));
  }, []);

  useEffect(() => {
    const pid = currentProject?.id;
    const q = pid ? `?project_id=${pid}` : '';
    setLoading(true);
    Promise.all([
      api.get(`/dashboard${q}`),
      api.get(`/inspections/summary${q}`),
      api.get(`/inspections${q}`),
      api.get(`/inspections/defects/all${q}`),
    ]).then(([dash, summ, insps, defs]) => {
      setData(dash);
      setSummary(summ);
      setRecentInsp(insps.slice(0, 8));
      setRecentDefects(defs.filter(d => d.status !== 'Resolved').slice(0, 8));
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const is = summary?.inspections || {};
  const ds = summary?.defects || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quality Inspector Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{currentProject?.name || 'All Projects'} · Inspections and defect tracking</p>
        </div>
        <button onClick={() => setShowPicker(true)}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Customize
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Inspections" value={is.total || 0} color="blue" />
        <StatCard label="Scheduled" value={is.scheduled || 0} color="purple" />
        <StatCard label="In Progress" value={is.inProgress || 0} color="yellow" />
        <StatCard label="Pass Rate" value={`${is.passRate || 0}%`} color="green" />
        <StatCard label="Open Defects" value={ds.open || 0} color="red" />
        <StatCard label="High Severity" value={ds.highSeverity || 0} color="red" />
      </div>

      {/* Defect severity breakdown */}
      {(ds.total || 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Defect Overview</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden flex">
              {ds.open > 0 && <div className="bg-red-500 h-full" style={{ width: `${(ds.open / ds.total) * 100}%` }} />}
              {ds.inProgress > 0 && <div className="bg-amber-500 h-full" style={{ width: `${(ds.inProgress / ds.total) * 100}%` }} />}
              {ds.resolved > 0 && <div className="bg-green-500 h-full" style={{ width: `${(ds.resolved / ds.total) * 100}%` }} />}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Open {ds.open}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />In Progress {ds.inProgress}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Resolved {ds.resolved}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inspections */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Recent Inspections</h3>
            <button onClick={() => navigate('/quality')} className="text-xs text-blue-600 hover:text-blue-800">View All</button>
          </div>
          <div className="space-y-2">
            {recentInsp.map(insp => (
              <div key={insp.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{insp.inspection_code}</span>
                    <span className="text-xs text-indigo-600 font-medium">{insp.type || 'General'}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{insp.stage_name} · {formatDate(insp.inspection_date)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {insp.result && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      insp.result === 'Pass' ? 'bg-green-100 text-green-700' :
                      insp.result === 'Fail' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{insp.result}</span>
                  )}
                  <Badge status={insp.status} />
                </div>
              </div>
            ))}
            {recentInsp.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No inspections yet</p>}
          </div>
        </div>

        {/* Open/Active Defects */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Active Defects</h3>
            <button onClick={() => navigate('/defects')} className="text-xs text-blue-600 hover:text-blue-800">View All</button>
          </div>
          <div className="space-y-2">
            {recentDefects.map(defect => (
              <div key={defect.id} className="flex items-start justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-slate-400">{defect.defect_code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[defect.severity] || ''}`}>
                      {defect.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 truncate">{defect.description}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    {defect.location && <span>@ {defect.location}</span>}
                    {defect.assigned_to && <span>· {defect.assigned_to}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge status={defect.status} />
                  {defect.due_date && (
                    <span className={`text-[10px] ${new Date(defect.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                      Due {formatDate(defect.due_date)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {recentDefects.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No active defects</p>}
          </div>
        </div>
      </div>

      {showPicker && (
        <WidgetPicker
          currentLayout={layout || DEFAULT_LAYOUTS.inspector}
          role="inspector"
          onSave={(newLayout) => { setLayout(newLayout); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
