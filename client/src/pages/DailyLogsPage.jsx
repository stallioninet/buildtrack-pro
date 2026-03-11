import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Stormy', 'Hot', 'Cold'];

export default function DailyLogsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const canCreate = !['accounts'].includes(user?.role);
  const canDelete = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    api.get(`/daily-logs?project_id=${currentProject.id}`)
      .then(setLogs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this daily log?')) return;
    try {
      await api.delete(`/daily-logs/${id}`);
      loadData();
    } catch (err) { alert(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Daily Logs</h1>
        {canCreate && (
          <button onClick={() => { setSelectedLog(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Log
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No daily logs found</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{formatDate(log.log_date)}</h3>
                  <p className="text-xs text-slate-400">Logged by {log.logged_by_name || 'Unknown'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {log.weather && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">{log.weather}</span>
                  )}
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded">{log.labor_count} workers</span>
                  <button onClick={() => { setSelectedLog(log); setShowModal(true); }}
                    className="text-slate-400 hover:text-blue-600 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  {canDelete && (
                    <button onClick={() => handleDelete(log.id)}
                      className="text-slate-400 hover:text-red-600 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
              {log.work_description && (
                <p className="text-sm text-slate-600 mb-2">{log.work_description}</p>
              )}
              {log.issues && (
                <div className="mt-2 px-3 py-2 bg-red-50 rounded-lg">
                  <p className="text-xs font-medium text-red-700">Issues:</p>
                  <p className="text-sm text-red-600">{log.issues}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <DailyLogModal
          log={selectedLog}
          projectId={currentProject.id}
          onClose={() => { setShowModal(false); setSelectedLog(null); }}
          onSaved={() => { setShowModal(false); setSelectedLog(null); loadData(); }}
        />
      )}
    </div>
  );
}

function DailyLogModal({ log, projectId, onClose, onSaved }) {
  const isEdit = !!log;
  const [form, setForm] = useState({
    log_date: log?.log_date || new Date().toISOString().split('T')[0],
    weather: log?.weather || '',
    work_description: log?.work_description || '',
    labor_count: log?.labor_count || 0,
    issues: log?.issues || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.log_date) return alert('Date is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/daily-logs/${log.id}`, form);
      } else {
        await api.post('/daily-logs', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Daily Log' : 'New Daily Log'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Date *</label>
              <input type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Weather</label>
              <select value={form.weather} onChange={e => set('weather', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select</option>
                {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Labor Count</label>
            <input type="number" value={form.labor_count} onChange={e => set('labor_count', parseInt(e.target.value) || 0)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" min="0" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Work Description</label>
            <textarea value={form.work_description} onChange={e => set('work_description', e.target.value)}
              rows={4} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Describe work done today..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Issues / Delays</label>
            <textarea value={form.issues} onChange={e => set('issues', e.target.value)}
              rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Any issues, delays, or concerns..." />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
