import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { showError, showWarning } from '../utils/toast';
import StatCard from '../components/ui/StatCard';

const TYPE_COLORS = {
  labor: 'bg-blue-100 text-blue-700',
  equipment: 'bg-amber-100 text-amber-700',
  material: 'bg-green-100 text-green-700',
};

const TYPE_ICONS = {
  labor: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  equipment: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  material: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
};

export default function ResourcesPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editResource, setEditResource] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [filterType, setFilterType] = useState('');

  const canManage = ['pm', 'engineer', 'owner'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    Promise.all([
      api.get(`/resources?project_id=${currentProject.id}${filterType ? `&type=${filterType}` : ''}`),
      api.get(`/resources/summary?project_id=${currentProject.id}`),
    ]).then(([res, sum]) => {
      setResources(res);
      setSummary(sum);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); loadData(); }, [currentProject?.id, filterType]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this resource and all its assignments?')) return;
    try {
      await api.delete(`/resources/${id}`);
      loadData();
    } catch (err) { showError(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Resources</h1>
          <p className="text-sm text-slate-500 mt-1">Manage labor, equipment, and materials for your project</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditResource(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <span>+</span> Add Resource
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Resources" value={summary.total} color="blue" />
          <StatCard label="Labor" value={summary.byType?.find(t => t.type === 'labor')?.count || 0} color="purple" />
          <StatCard label="Equipment" value={summary.byType?.find(t => t.type === 'equipment')?.count || 0} color="orange" />
          <StatCard label="Planned Cost" value={formatCurrency(summary.totalPlannedCost)} color="green" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'labor', 'equipment', 'material'].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterType === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t || 'All'}
          </button>
        ))}
      </div>

      {/* Resource List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : resources.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No resources found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(res => (
            <div key={res.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TYPE_COLORS[res.type]}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TYPE_ICONS[res.type]} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{res.name}</h3>
                    <span className="text-xs text-slate-400">{res.resource_code}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[res.type]}`}>
                  {res.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400">Rate</span>
                  <p className="font-semibold text-slate-700">{formatCurrency(res.rate)}/{res.unit || 'unit'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400">Available</span>
                  <p className="font-semibold text-slate-700">{res.available_qty} {res.unit || 'units'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400">Assigned</span>
                  <p className="font-semibold text-slate-700">{res.total_actual} used</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400">Utilization</span>
                  <p className={`font-semibold ${res.utilization > 90 ? 'text-red-600' : res.utilization > 70 ? 'text-amber-600' : 'text-green-600'}`}>
                    {res.utilization}%
                  </p>
                </div>
              </div>

              {/* Utilization bar */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                <div
                  className={`h-1.5 rounded-full transition-all ${res.utilization > 90 ? 'bg-red-500' : res.utilization > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, res.utilization)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setShowDetail(res)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View Details
                </button>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditResource(res); setShowModal(true); }}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(res.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ResourceModal
          resource={editResource}
          projectId={currentProject.id}
          onClose={() => { setShowModal(false); setEditResource(null); }}
          onSaved={() => { setShowModal(false); setEditResource(null); loadData(); }}
        />
      )}

      {showDetail && (
        <ResourceDetailModal
          resource={showDetail}
          canManage={canManage}
          onClose={() => setShowDetail(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}

function ResourceModal({ resource, projectId, onClose, onSaved }) {
  const isEdit = !!resource;
  const [form, setForm] = useState({
    type: resource?.type || 'labor',
    name: resource?.name || '',
    unit: resource?.unit || '',
    rate: resource?.rate || 0,
    available_qty: resource?.available_qty || 0,
    status: resource?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const UNIT_SUGGESTIONS = { labor: 'days', equipment: 'days', material: 'units' };

  const handleSave = async () => {
    if (!form.name.trim()) return showWarning('Name is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/resources/${resource.id}`, form);
      } else {
        await api.post('/resources', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) { showError(err.message); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Resource' : 'Add Resource'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Type *</label>
            <select value={form.type} onChange={e => { set('type', e.target.value); if (!form.unit) set('unit', UNIT_SUGGESTIONS[e.target.value]); }}
              disabled={isEdit}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 disabled:bg-slate-50">
              <option value="labor">Labor</option>
              <option value="equipment">Equipment</option>
              <option value="material">Material</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="e.g., Mason Team A, Concrete Mixer, TMT Steel" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Unit</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="days, kg, bags" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Rate (per unit)</label>
              <input type="number" value={form.rate} onChange={e => set('rate', parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" min="0" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Available Qty</label>
              <input type="number" value={form.available_qty} onChange={e => set('available_qty', parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" min="0" />
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="text-xs text-slate-500 font-medium">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
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

function ResourceDetailModal({ resource, canManage, onClose, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [assignForm, setAssignForm] = useState({ task_id: '', planned_qty: 0, actual_qty: 0, date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => {
    api.get(`/resources/${resource.id}`).then(setDetail).catch(console.error).finally(() => setLoading(false));
  }, [resource.id]);

  const loadTasks = () => {
    if (tasks.length > 0) return;
    api.get(`/tasks?project_id=${resource.project_id}&flat=1&limit=200`)
      .then(res => setTasks(res.data || []))
      .catch(console.error);
  };

  const handleAssign = async () => {
    if (!assignForm.task_id) return showWarning('Select a task');
    try {
      await api.post(`/resources/${resource.id}/assignments`, assignForm);
      const updated = await api.get(`/resources/${resource.id}`);
      setDetail(updated);
      setShowAssignForm(false);
      setAssignForm({ task_id: '', planned_qty: 0, actual_qty: 0, date: new Date().toISOString().split('T')[0], notes: '' });
      onUpdated();
    } catch (err) { showError(err.message); }
  };

  const handleDeleteAssignment = async (assignId) => {
    try {
      await api.delete(`/resources/assignments/${assignId}`);
      const updated = await api.get(`/resources/${resource.id}`);
      setDetail(updated);
      onUpdated();
    } catch (err) { showError(err.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">{resource.name}</h3>
            <span className="text-xs text-slate-400">{resource.resource_code} - {resource.type}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : detail ? (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <span className="text-xs text-slate-400 block">Rate</span>
                  <span className="text-sm font-bold text-slate-700">{formatCurrency(detail.rate)}/{detail.unit}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <span className="text-xs text-slate-400 block">Available</span>
                  <span className="text-sm font-bold text-slate-700">{detail.available_qty}</span>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <span className="text-xs text-blue-500 block">Planned</span>
                  <span className="text-sm font-bold text-blue-700">{detail.assignments?.reduce((s, a) => s + a.planned_qty, 0) || 0}</span>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <span className="text-xs text-green-500 block">Actual</span>
                  <span className="text-sm font-bold text-green-700">{detail.assignments?.reduce((s, a) => s + a.actual_qty, 0) || 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Assignments ({detail.assignments?.length || 0})</h4>
                {canManage && (
                  <button onClick={() => { setShowAssignForm(!showAssignForm); loadTasks(); }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    {showAssignForm ? 'Cancel' : '+ Assign to Task'}
                  </button>
                )}
              </div>

              {showAssignForm && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <select value={assignForm.task_id} onChange={e => setAssignForm(f => ({ ...f, task_id: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                    <option value="">Select task...</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.task_code} - {t.title}</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-500">Planned Qty</label>
                      <input type="number" value={assignForm.planned_qty} onChange={e => setAssignForm(f => ({ ...f, planned_qty: parseFloat(e.target.value) || 0 }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" min="0" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Actual Qty</label>
                      <input type="number" value={assignForm.actual_qty} onChange={e => setAssignForm(f => ({ ...f, actual_qty: parseFloat(e.target.value) || 0 }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" min="0" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Date</label>
                      <input type="date" value={assignForm.date} onChange={e => setAssignForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
                    </div>
                  </div>
                  <input value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                    placeholder="Notes (optional)" />
                  <button onClick={handleAssign}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Add Assignment
                  </button>
                </div>
              )}

              {detail.assignments?.length > 0 ? (
                <div className="space-y-2">
                  {detail.assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg p-3">
                      <div>
                        <span className="text-sm font-medium text-slate-700">{a.task_code} - {a.task_title}</span>
                        <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                          <span>Stage: {a.stage_name}</span>
                          <span>Planned: {a.planned_qty}</span>
                          <span>Actual: {a.actual_qty}</span>
                          {a.date && <span>{a.date}</span>}
                        </div>
                        {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                      </div>
                      {canManage && (
                        <button onClick={() => handleDeleteAssignment(a.id)}
                          className="p-1 text-slate-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-4">No assignments yet</p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
