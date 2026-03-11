import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import Badge from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import CommentsSection from '../components/shared/CommentsSection';

const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Executed', 'Void'];
const TYPES = [
  { value: 'scope_change', label: 'Scope Change' },
  { value: 'design_change', label: 'Design Change' },
  { value: 'site_condition', label: 'Site Condition' },
  { value: 'client_request', label: 'Client Request' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'value_engineering', label: 'Value Engineering' },
];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Executed: 'bg-purple-100 text-purple-700',
  Void: 'bg-slate-200 text-slate-500',
};

export default function ChangeOrdersPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '' });
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stages, setStages] = useState([]);

  const canCreate = ['owner', 'pm', 'engineer'].includes(user?.role);
  const canApprove = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    Promise.all([
      api.get(`/change-orders?project_id=${pid}${filter.status ? `&status=${filter.status}` : ''}`),
      api.get(`/change-orders/summary?project_id=${pid}`),
    ]).then(([data, sum]) => {
      setItems(data);
      setSummary(sum);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
  }, [currentProject?.id]);

  const handleStatusChange = async (item, newStatus) => {
    try {
      await api.patch(`/change-orders/${item.id}/status`, { status: newStatus });
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this change order?')) return;
    try { await api.delete(`/change-orders/${id}`); loadData(); } catch (err) { alert(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Change Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track scope changes, cost and schedule impacts</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelected(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Change Order
          </button>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total COs" value={summary.total} color="blue" />
          <StatCard label="Pending Review" value={summary.pending} color="orange" />
          <StatCard label="Approved" value={summary.approved} color="green" />
          <StatCard label="Cost Impact" value={formatCurrency(summary.totalCostImpact)} color={summary.totalCostImpact > 0 ? 'red' : 'green'} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <select value={filter.status} onChange={e => setFilter({ status: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No change orders found</div>
      ) : (
        <div className="space-y-3">
          {items.map(co => (
            <div key={co.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{co.co_code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[co.status] || 'bg-slate-100'}`}>
                      {co.status}
                    </span>
                    <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">
                      {TYPES.find(t => t.value === co.type)?.label || co.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                    onClick={() => { setSelected(co); setShowModal(true); }}>
                    {co.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                    {co.stage_name && <span>{co.stage_name}</span>}
                    {co.cost_impact !== 0 && (
                      <span className={co.cost_impact > 0 ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                        {co.cost_impact > 0 ? '+' : ''}{formatCurrency(co.cost_impact)}
                      </span>
                    )}
                    {co.schedule_impact_days !== 0 && (
                      <span className={co.schedule_impact_days > 0 ? 'text-red-500' : 'text-green-500'}>
                        {co.schedule_impact_days > 0 ? '+' : ''}{co.schedule_impact_days} days
                      </span>
                    )}
                    {co.requested_by_name && <span>By: {co.requested_by_name}</span>}
                    {co.due_date && <span>Due: {formatDate(co.due_date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {co.status !== 'Executed' && co.status !== 'Void' && (
                    <select value={co.status} onChange={e => handleStatusChange(co, e.target.value)}
                      className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {['owner', 'pm'].includes(user?.role) && (
                    <button onClick={() => handleDelete(co.id)} className="text-slate-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <COModal co={selected} projectId={currentProject.id} stages={stages}
          onClose={() => { setShowModal(false); setSelected(null); }}
          onSaved={() => { setShowModal(false); setSelected(null); loadData(); }} />
      )}
    </div>
  );
}

function COModal({ co, projectId, stages, onClose, onSaved }) {
  const isEdit = !!co;
  const [form, setForm] = useState({
    title: co?.title || '', description: co?.description || '', reason: co?.reason || '',
    type: co?.type || 'scope_change', stage_id: co?.stage_id || '',
    cost_impact: co?.cost_impact || 0, schedule_impact_days: co?.schedule_impact_days || 0,
    due_date: co?.due_date || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required');
    setSaving(true);
    try {
      if (isEdit) await api.patch(`/change-orders/${co.id}`, form);
      else await api.post('/change-orders', { ...form, project_id: projectId });
      onSaved();
    } catch (err) { alert(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${co.co_code} — Edit Change Order` : 'New Change Order'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Change order title" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Stage</label>
              <select value={form.stage_id} onChange={e => set('stage_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Detailed description of the change" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Reason / Justification</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
              rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Why is this change needed?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Cost Impact (Rs.)</label>
              <input type="number" value={form.cost_impact} onChange={e => set('cost_impact', parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Positive = increase" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Schedule Impact (days)</label>
              <input type="number" value={form.schedule_impact_days} onChange={e => set('schedule_impact_days', parseInt(e.target.value) || 0)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Positive = delay" />
            </div>
          </div>
          {isEdit && <CommentsSection entityType="change_order" entityId={co.id} />}
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
