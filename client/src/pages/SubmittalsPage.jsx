import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import CommentsSection from '../components/shared/CommentsSection';

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Revise & Resubmit': 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700',
  'Approved as Noted': 'bg-teal-100 text-teal-700',
  Rejected: 'bg-red-100 text-red-700',
  Closed: 'bg-slate-200 text-slate-500',
};

const PRIORITY_COLORS = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TYPES = [
  { value: 'shop_drawing', label: 'Shop Drawing' },
  { value: 'product_data', label: 'Product Data' },
  { value: 'sample', label: 'Sample' },
  { value: 'mock_up', label: 'Mock-Up' },
  { value: 'test_report', label: 'Test Report' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'method_statement', label: 'Method Statement' },
  { value: 'other', label: 'Other' },
];

const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Revise & Resubmit', 'Approved', 'Approved as Noted', 'Rejected', 'Closed'];

export default function SubmittalsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [submittals, setSubmittals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', type: '' });
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stages, setStages] = useState([]);
  const [vendors, setVendors] = useState([]);

  const canCreate = ['pm', 'engineer', 'contractor'].includes(user?.role);
  const canReview = ['pm', 'engineer', 'owner', 'inspector'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    let url = `/submittals?project_id=${pid}`;
    if (filter.status) url += `&status=${filter.status}`;
    if (filter.type) url += `&submittal_type=${filter.type}`;
    Promise.all([
      api.get(url),
      api.get(`/submittals/summary?project_id=${pid}`),
    ]).then(([data, sum]) => {
      setSubmittals(data);
      setSummary(sum);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
    api.get(`/vendors?project_id=${currentProject.id}`).then(setVendors).catch(() => {});
  }, [currentProject?.id]);

  const handleStatusChange = async (sub, newStatus) => {
    try {
      await api.patch(`/submittals/${sub.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (sub) => {
    if (!confirm(`Delete ${sub.submittal_code}?`)) return;
    try { await api.delete(`/submittals/${sub.id}`); loadData(); } catch (err) { alert(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Submittals</h1>
          <p className="text-sm text-slate-500 mt-1">Track shop drawings, product data, samples, and approvals</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelected(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Submittal
          </button>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
            <p className="text-xs text-slate-500">Total Submittals</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
            <p className="text-xs text-slate-500">Pending Review</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-green-600">{summary.approved}</p>
            <p className="text-xs text-slate-500">Approved</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
            <p className="text-xs text-slate-500">Overdue</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading submittals...</div>
      ) : submittals.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No submittals found</div>
      ) : (
        <div className="space-y-3">
          {submittals.map(sub => (
            <div key={sub.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{sub.submittal_code}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600">
                      {TYPES.find(t => t.value === sub.submittal_type)?.label || sub.submittal_type}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${PRIORITY_COLORS[sub.priority] || ''}`}>
                      {sub.priority}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] || ''}`}>
                      {sub.status}
                    </span>
                    {sub.revision !== 'R0' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-600">{sub.revision}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                    onClick={() => { setSelected(sub); setShowModal(true); }}>
                    {sub.title}
                  </h3>
                  {sub.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sub.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                    {sub.spec_section && <span className="text-indigo-500">Spec: {sub.spec_section}</span>}
                    {sub.stage_name && <span>{sub.stage_name}</span>}
                    {sub.vendor_name && <span>Vendor: {sub.vendor_name}</span>}
                    {sub.submitted_by_name && <span>By: {sub.submitted_by_name}</span>}
                    {sub.due_date && <span>Due: {formatDate(sub.due_date)}</span>}
                  </div>
                  {sub.review_notes && (
                    <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-amber-600 font-medium mb-0.5">
                        Review Notes {sub.reviewer_name && `by ${sub.reviewer_name}`}
                      </p>
                      <p className="text-xs text-amber-800 line-clamp-2">{sub.review_notes}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {canReview && ['Submitted', 'Under Review'].includes(sub.status) && (
                    <select value="" onChange={e => {
                      if (e.target.value === 'review_notes') {
                        const notes = prompt('Enter review notes:');
                        if (notes) api.patch(`/submittals/${sub.id}/status`, { status: sub.status === 'Submitted' ? 'Under Review' : sub.status, review_notes: notes }).then(loadData);
                      } else if (e.target.value) {
                        handleStatusChange(sub, e.target.value);
                      }
                    }} className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white">
                      <option value="">Action...</option>
                      {sub.status === 'Submitted' && <option value="Under Review">Start Review</option>}
                      <option value="Approved">Approve</option>
                      <option value="Approved as Noted">Approve as Noted</option>
                      <option value="Revise & Resubmit">Revise & Resubmit</option>
                      <option value="Rejected">Reject</option>
                      <option value="review_notes">Add Review Notes</option>
                    </select>
                  )}
                  {sub.status !== 'Closed' && sub.status !== 'Rejected' && !['Submitted', 'Under Review'].includes(sub.status) && (
                    <select value={sub.status} onChange={e => handleStatusChange(sub, e.target.value)}
                      className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {['owner', 'pm'].includes(user?.role) && (
                    <button onClick={() => handleDelete(sub)}
                      className="text-[10px] px-2 py-1 text-red-500 hover:bg-red-50 rounded">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SubmittalModal
          submittal={selected}
          projectId={currentProject.id}
          stages={stages}
          vendors={vendors}
          onClose={() => { setShowModal(false); setSelected(null); }}
          onSaved={() => { setShowModal(false); setSelected(null); loadData(); }}
        />
      )}
    </div>
  );
}

function SubmittalModal({ submittal, projectId, stages, vendors, onClose, onSaved }) {
  const isEdit = !!submittal;
  const [form, setForm] = useState({
    title: submittal?.title || '',
    submittal_type: submittal?.submittal_type || 'shop_drawing',
    spec_section: submittal?.spec_section || '',
    description: submittal?.description || '',
    stage_id: submittal?.stage_id || '',
    vendor_id: submittal?.vendor_id || '',
    priority: submittal?.priority || 'medium',
    due_date: submittal?.due_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [newRevision, setNewRevision] = useState('');

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/submittals/${submittal.id}`, form);
      } else {
        await api.post('/submittals', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRevise = async () => {
    if (!newRevision.trim()) return alert('Revision number is required');
    setSaving(true);
    try {
      await api.patch(`/submittals/${submittal.id}/revise`, { revision: newRevision, description: form.description });
      onSaved();
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${submittal.submittal_code} — ${submittal.revision}` : 'New Submittal'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="e.g., Structural Steel Shop Drawings - Beam B4" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Type</label>
              <select value={form.submittal_type} onChange={e => set('submittal_type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Spec Section</label>
              <input type="text" value={form.spec_section} onChange={e => set('spec_section', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., 05 12 00" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Detailed description of what is being submitted" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Stage</label>
              <select value={form.stage_id} onChange={e => set('stage_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Vendor</label>
              <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
          </div>

          {isEdit && submittal.status === 'Revise & Resubmit' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <button onClick={() => setShowRevise(!showRevise)}
                className="text-xs font-medium text-orange-700 hover:text-orange-800">
                {showRevise ? '▾ New Revision' : '▸ Submit New Revision'}
              </button>
              {showRevise && (
                <div className="mt-2 space-y-2">
                  <input type="text" value={newRevision} onChange={e => setNewRevision(e.target.value)}
                    placeholder={`e.g., R${parseInt((submittal.revision || 'R0').replace('R', '')) + 1}`}
                    className="w-full text-sm border border-orange-200 rounded px-3 py-1.5" />
                  <button onClick={handleRevise} disabled={saving}
                    className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">
                    {saving ? 'Submitting...' : 'Submit Revision'}
                  </button>
                </div>
              )}
            </div>
          )}

          {isEdit && <CommentsSection entityType="submittal" entityId={submittal.id} />}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Submittal'}
          </button>
        </div>
      </div>
    </div>
  );
}
