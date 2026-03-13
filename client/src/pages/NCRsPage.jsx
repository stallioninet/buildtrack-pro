import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import { showError, showWarning } from '../utils/toast';
import CommentsSection from '../components/shared/CommentsSection';
import Pagination from '../components/ui/Pagination';
import FormInput from '../components/ui/FormInput';
import useFormValidation from '../hooks/useFormValidation';
import { NCR_SEVERITY_COLORS as SEVERITY_COLORS, NCR_STATUS_COLORS as STATUS_COLORS } from '../config/constants';
import { SkeletonTable } from '../components/ui/Skeleton';

const STATUSES = ['Identified', 'Reported', 'Under Review', 'Root Cause Analysis', 'Disposition', 'Corrective Action', 'Verification', 'Closed'];
const SEVERITIES = ['Minor', 'Major', 'Critical'];
const CATEGORIES = ['Workmanship', 'Material', 'Design', 'Method', 'Supervision', 'Environmental'];
const DISPOSITIONS = ['Rework', 'Repair', 'Use-As-Is', 'Reject'];
const RCA_METHODS = [
  { value: '5_whys', label: '5 Whys' },
  { value: 'fishbone', label: 'Fishbone / Ishikawa' },
  { value: 'pareto', label: 'Pareto Analysis' },
  { value: 'other', label: 'Other' },
];

export default function NCRsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [ncrs, setNCRs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedNCR, setSelectedNCR] = useState(null);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);

  const canCreate = ['pm', 'engineer', 'inspector'].includes(user?.role);
  const canChangeStatus = ['pm', 'engineer', 'inspector', 'contractor'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    Promise.all([
      api.get(`/ncrs?project_id=${pid}${filter.status ? `&status=${filter.status}` : ''}${filter.severity ? `&severity=${filter.severity}` : ''}&page=${page}&limit=50`),
      api.get(`/ncrs/summary?project_id=${pid}`),
    ]).then(([ncrsData, summaryData]) => {
      if (ncrsData && ncrsData.data) {
        setNCRs(ncrsData.data);
        setPagination(ncrsData.pagination);
      } else {
        setNCRs(Array.isArray(ncrsData) ? ncrsData : []);
        setPagination(null);
      }
      setSummary(summaryData);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter, page]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
    api.get('/auth/users').then(setUsers).catch(() => setUsers([]));
  }, [currentProject?.id]);

  const handleStatusChange = async (ncr, newStatus) => {
    try {
      await api.patch(`/ncrs/${ncr.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Non-Conformance Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Track quality issues, root causes, and corrective actions</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelectedNCR(null); setShowModal(true); }}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
            + Raise NCR
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
            <p className="text-xs text-slate-500">Total NCRs</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-orange-600">{summary.open}</p>
            <p className="text-xs text-slate-500">Open</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
            <p className="text-xs text-slate-500">Critical Open</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex gap-1 flex-wrap">
              {summary.byCategory?.map(c => (
                <span key={c.category} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {c.category}: {c.count}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">By Category</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.severity} onChange={e => { setFilter(f => ({ ...f, severity: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* NCR List */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : ncrs.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No NCRs found</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
          {ncrs.map(ncr => (
            <div key={ncr.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{ncr.ncr_code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${SEVERITY_COLORS[ncr.severity] || ''}`}>
                      {ncr.severity}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ncr.status] || 'bg-slate-100 text-slate-600'}`}>
                      {ncr.status}
                    </span>
                    <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">{ncr.category}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                    onClick={() => { setSelectedNCR(ncr); setShowModal(true); }}>
                    {ncr.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                    {ncr.stage_name && <span>{ncr.stage_name}</span>}
                    {ncr.location && <span>@ {ncr.location}</span>}
                    {ncr.is_code_ref && <span className="text-blue-500">{ncr.is_code_ref}</span>}
                    {ncr.raised_by_name && <span>Raised by: {ncr.raised_by_name}</span>}
                    {ncr.assigned_to_name && <span>Assigned: {ncr.assigned_to_name}</span>}
                    {ncr.due_date && <span className={ncr.due_date < new Date().toISOString().split('T')[0] && ncr.status !== 'Closed' ? 'text-red-500 font-medium' : ''}>Due: {formatDate(ncr.due_date)}</span>}
                  </div>
                  {ncr.disposition && (
                    <span className="inline-block mt-1.5 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">
                      Disposition: {ncr.disposition}
                    </span>
                  )}
                </div>
                {canChangeStatus && ncr.status !== 'Closed' && ncr.status !== 'Void' && (
                  <select
                    value={ncr.status}
                    onChange={e => handleStatusChange(ncr, e.target.value)}
                    className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white flex-shrink-0"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
        </div>
      )}

      {/* NCR Modal */}
      {showModal && (
        <NCRModal
          ncr={selectedNCR}
          projectId={currentProject.id}
          stages={stages}
          users={users}
          onClose={() => { setShowModal(false); setSelectedNCR(null); }}
          onSaved={() => { setShowModal(false); setSelectedNCR(null); loadData(); }}
        />
      )}
    </div>
  );
}

function NCRModal({ ncr, projectId, stages, users, onClose, onSaved }) {
  const isEdit = !!ncr;
  const [form, setForm] = useState({
    title: ncr?.title || '',
    description: ncr?.description || '',
    severity: ncr?.severity || 'Major',
    category: ncr?.category || 'Workmanship',
    stage_id: ncr?.stage_id || '',
    location: ncr?.location || '',
    is_code_ref: ncr?.is_code_ref || '',
    assigned_to: ncr?.assigned_to || '',
    due_date: ncr?.due_date || '',
    root_cause: ncr?.root_cause || '',
    root_cause_method: ncr?.root_cause_method || '',
    disposition: ncr?.disposition || '',
    corrective_action: ncr?.corrective_action || '',
    verification_notes: ncr?.verification_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const { errors, validate, clearError } = useFormValidation({
    title: { required: true, label: 'Title', minLength: 3 },
  });

  const handleSave = async () => {
    if (!validate(form)) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/ncrs/${ncr.id}`, form);
      } else {
        await api.post('/ncrs', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save NCR');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${ncr.ncr_code} — Edit NCR` : 'Raise New NCR'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <FormInput label="Title" required name="title" value={form.title}
            onChange={e => { set('title', e.target.value); clearError('title'); }}
            error={errors.title}
            placeholder="Brief description of the non-conformance" />

          {/* Row: Severity + Category + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Severity</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Stage</label>
              <select value={form.stage_id} onChange={e => set('stage_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Detailed description with measurements, extent, and observations" />
          </div>

          {/* Row: Location + IS Code Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Location</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., Column C3, 2nd Floor, Grid 3-D" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">IS Code Reference</label>
              <input type="text" value={form.is_code_ref} onChange={e => set('is_code_ref', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., IS 456:2000 Cl. 14.3" />
            </div>
          </div>

          {/* Row: Assigned To + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Assign To</label>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>

          {/* CAPA Section (shown on edit) */}
          {isEdit && (
            <div className="border-t pt-4 mt-4 space-y-4">
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Root Cause & Corrective Action</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium">RCA Method</label>
                  <select value={form.root_cause_method} onChange={e => set('root_cause_method', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                    <option value="">Select method</option>
                    {RCA_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Disposition</label>
                  <select value={form.disposition} onChange={e => set('disposition', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                    <option value="">Select disposition</option>
                    {DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Root Cause Analysis</label>
                <textarea value={form.root_cause} onChange={e => set('root_cause', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Document the root cause (5 Whys, fishbone, etc.)" />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Corrective Action</label>
                <textarea value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Describe the corrective action to be taken" />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Verification Notes</label>
                <textarea value={form.verification_notes} onChange={e => set('verification_notes', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Notes from verification re-inspection" />
              </div>
            </div>
          )}

          {isEdit && <CommentsSection entityType="ncr" entityId={ncr.id} />}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update NCR' : 'Raise NCR'}
          </button>
        </div>
      </div>
    </div>
  );
}
