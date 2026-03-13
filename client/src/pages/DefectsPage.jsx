import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import { formatDate } from '../utils/formatters';
import { showError } from '../utils/toast';
import { DEFECT_SEVERITY_COLORS as SEVERITY_COLORS, STATUS_DOTS, DEFECT_STATUSES, DEFECT_SEVERITIES } from '../config/constants';

export default function DefectsPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [editingDefect, setEditingDefect] = useState(null);

  const projectId = currentProject?.id;
  const canEdit = ['pm', 'engineer', 'inspector'].includes(user?.role);

  const loadDefects = () => {
    setLoading(true);
    const q = projectId ? `?project_id=${projectId}` : '';
    api.get(`/inspections/defects/all${q}`)
      .then(setDefects)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDefects(); }, [projectId]);

  const handleStatusChange = async (defectId, newStatus) => {
    try {
      await api.patch(`/inspections/defects/${defectId}`, { status: newStatus });
      loadDefects();
    } catch (err) {
      showError(err.message || 'Failed to update');
    }
  };

  const filtered = defects.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (severityFilter && d.severity !== severityFilter) return false;
    return true;
  });

  const openCount = defects.filter(d => d.status === 'Open').length;
  const inProgressCount = defects.filter(d => d.status === 'In Progress').length;
  const highCount = defects.filter(d => d.severity === 'High' && d.status !== 'Resolved').length;
  const overdueCount = defects.filter(d => d.due_date && new Date(d.due_date) < new Date() && d.status !== 'Resolved').length;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Defect Tracker</h1>
        <p className="text-sm text-slate-500 mt-1">{currentProject?.name || 'All Projects'}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => { setStatusFilter('Open'); setSeverityFilter(''); }}
          className={`p-4 rounded-xl border text-left transition-colors ${statusFilter === 'Open' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:bg-red-50'}`}>
          <p className="text-2xl font-bold text-red-600">{openCount}</p>
          <p className="text-xs text-slate-500">Open</p>
        </button>
        <button onClick={() => { setStatusFilter('In Progress'); setSeverityFilter(''); }}
          className={`p-4 rounded-xl border text-left transition-colors ${statusFilter === 'In Progress' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-amber-50'}`}>
          <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
          <p className="text-xs text-slate-500">In Progress</p>
        </button>
        <button onClick={() => { setSeverityFilter('High'); setStatusFilter(''); }}
          className={`p-4 rounded-xl border text-left transition-colors ${severityFilter === 'High' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:bg-red-50'}`}>
          <p className="text-2xl font-bold text-red-700">{highCount}</p>
          <p className="text-xs text-slate-500">High Severity</p>
        </button>
        <button onClick={() => { setStatusFilter(''); setSeverityFilter(''); }}
          className={`p-4 rounded-xl border text-left transition-colors ${overdueCount > 0 ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{overdueCount}</p>
          <p className="text-xs text-slate-500">Overdue</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600">
          <option value="">All Statuses</option>
          {DEFECT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600">
          <option value="">All Severities</option>
          {DEFECT_SEVERITIES.map(s => <option key={s}>{s}</option>)}
        </select>
        {(statusFilter || severityFilter) && (
          <button onClick={() => { setStatusFilter(''); setSeverityFilter(''); }}
            className="text-xs text-blue-600 hover:text-blue-800">Clear filters</button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {defects.length} defects</span>
      </div>

      {/* Defect list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Defect</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Location</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Severity</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Assigned</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Due</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
              {canEdit && <th className="text-left py-3 px-4 text-slate-500 font-medium w-32">Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(defect => (
              <tr key={defect.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-slate-400">{defect.defect_code}</span>
                    <span className="text-slate-700 truncate max-w-xs">{defect.description}</span>
                    <span className="text-xs text-slate-400">{defect.category}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-600 text-xs">
                  {defect.location || '-'}
                  {defect.stage_name && <div className="text-slate-400">{defect.stage_name}</div>}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[defect.severity] || ''}`}>
                    {defect.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600 text-xs">{defect.assigned_to || '-'}</td>
                <td className="py-3 px-4">
                  {defect.due_date ? (
                    <span className={`text-xs ${new Date(defect.due_date) < new Date() && defect.status !== 'Resolved' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                      {formatDate(defect.due_date)}
                    </span>
                  ) : <span className="text-xs text-slate-400">-</span>}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[defect.status] || 'bg-slate-300'}`} />
                    <span className="text-xs">{defect.status}</span>
                  </div>
                </td>
                {canEdit && (
                  <td className="py-3 px-4">
                    <select
                      value={defect.status}
                      onChange={e => handleStatusChange(defect.id, e.target.value)}
                      className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600"
                    >
                      {DEFECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            {defects.length === 0 ? 'No defects recorded' : 'No defects match filters'}
          </div>
        )}
      </div>
    </div>
  );
}
