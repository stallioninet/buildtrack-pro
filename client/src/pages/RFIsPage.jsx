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
import { RFI_STATUS_COLORS as STATUS_COLORS, PRIORITY_COLORS_BORDERED as PRIORITY_COLORS } from '../config/constants';
import { SkeletonTable } from '../components/ui/Skeleton';

const STATUSES = ['Draft', 'Open', 'Responded', 'Closed', 'Void'];

export default function RFIsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [rfis, setRFIs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedRFI, setSelectedRFI] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(null);
  const [stages, setStages] = useState([]);

  const canCreate = ['pm', 'engineer', 'contractor'].includes(user?.role);
  const canRespond = ['pm', 'engineer', 'owner'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    Promise.all([
      api.get(`/rfis?project_id=${pid}${filter.status ? `&status=${filter.status}` : ''}&page=${page}&limit=50`),
      api.get(`/rfis/summary?project_id=${pid}`),
    ]).then(([rfisData, summaryData]) => {
      if (rfisData && rfisData.data) {
        setRFIs(rfisData.data);
        setPagination(rfisData.pagination);
      } else {
        setRFIs(Array.isArray(rfisData) ? rfisData : []);
        setPagination(null);
      }
      setSummary(summaryData);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter, page]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
  }, [currentProject?.id]);

  const handleStatusChange = async (rfi, newStatus) => {
    try {
      await api.patch(`/rfis/${rfi.id}/status`, { status: newStatus });
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
          <h1 className="text-2xl font-bold text-slate-800">Requests for Information</h1>
          <p className="text-sm text-slate-500 mt-1">Track RFIs, responses, and resolution timelines</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelectedRFI(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New RFI
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
            <p className="text-xs text-slate-500">Total RFIs</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-blue-600">{summary.open}</p>
            <p className="text-xs text-slate-500">Open</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
            <p className="text-xs text-slate-500">Overdue</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-emerald-600">{summary.avgResponseDays}d</p>
            <p className="text-xs text-slate-500">Avg Response Time</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* RFI List */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : rfis.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No RFIs found</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
          {rfis.map(rfi => (
            <div key={rfi.id} className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow ${rfi.is_overdue ? 'border-red-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{rfi.rfi_code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${PRIORITY_COLORS[rfi.priority] || ''}`}>
                      {rfi.priority}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rfi.status] || ''}`}>
                      {rfi.status}
                    </span>
                    {rfi.is_overdue === 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">OVERDUE</span>
                    )}
                    {rfi.days_remaining !== null && rfi.days_remaining >= 0 && rfi.status === 'Open' && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${rfi.days_remaining <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {rfi.days_remaining}d remaining
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                    onClick={() => { setSelectedRFI(rfi); setShowModal(true); }}>
                    {rfi.subject}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rfi.question}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                    {rfi.stage_name && <span>{rfi.stage_name}</span>}
                    {rfi.drawing_ref && <span className="text-blue-500">Dwg: {rfi.drawing_ref}</span>}
                    {rfi.spec_ref && <span className="text-indigo-500">Ref: {rfi.spec_ref}</span>}
                    {rfi.raised_by_name && <span>By: {rfi.raised_by_name}</span>}
                    {rfi.due_date && <span>Due: {formatDate(rfi.due_date)}</span>}
                  </div>
                  {rfi.response && (
                    <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-green-600 font-medium mb-0.5">
                        Response by {rfi.response_by_name} on {formatDate(rfi.response_date)}
                      </p>
                      <p className="text-xs text-green-800 line-clamp-2">{rfi.response}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {canRespond && rfi.status === 'Open' && !rfi.response && (
                    <button onClick={() => setShowResponseModal(rfi)}
                      className="text-[10px] px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                      Respond
                    </button>
                  )}
                  {rfi.status !== 'Closed' && rfi.status !== 'Void' && (
                    <select value={rfi.status} onChange={e => handleStatusChange(rfi, e.target.value)}
                      className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <RFIModal
          rfi={selectedRFI}
          projectId={currentProject.id}
          stages={stages}
          onClose={() => { setShowModal(false); setSelectedRFI(null); }}
          onSaved={() => { setShowModal(false); setSelectedRFI(null); loadData(); }}
        />
      )}

      {/* Response Modal */}
      {showResponseModal && (
        <ResponseModal
          rfi={showResponseModal}
          onClose={() => setShowResponseModal(null)}
          onSaved={() => { setShowResponseModal(null); loadData(); }}
        />
      )}
    </div>
  );
}

function RFIModal({ rfi, projectId, stages, onClose, onSaved }) {
  const isEdit = !!rfi;
  const [form, setForm] = useState({
    subject: rfi?.subject || '',
    question: rfi?.question || '',
    drawing_ref: rfi?.drawing_ref || '',
    spec_ref: rfi?.spec_ref || '',
    stage_id: rfi?.stage_id || '',
    location: rfi?.location || '',
    priority: rfi?.priority || 'medium',
    due_date: rfi?.due_date || '',
  });
  const [saving, setSaving] = useState(false);
  const { errors, validate, clearError } = useFormValidation({
    subject: { required: true, label: 'Subject', minLength: 3 },
    question: { required: true, label: 'Question', minLength: 3 },
  });

  const handleSave = async () => {
    if (!validate(form)) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/rfis/${rfi.id}`, form);
      } else {
        await api.post('/rfis', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save RFI');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${rfi.rfi_code} — Edit RFI` : 'New RFI'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <FormInput label="Subject" required name="subject" value={form.subject}
            onChange={e => { set('subject', e.target.value); clearError('subject'); }}
            error={errors.subject}
            placeholder="Clear, concise subject line" />

          <FormInput label="Question" required name="question" type="textarea" value={form.question}
            onChange={e => { set('question', e.target.value); clearError('question'); }}
            error={errors.question} rows={4}
            placeholder="Detailed question with reference to drawing/spec number and location" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Drawing Reference</label>
              <input type="text" value={form.drawing_ref} onChange={e => set('drawing_ref', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., S-201 Rev C2" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Spec / IS Code Reference</label>
              <input type="text" value={form.spec_ref} onChange={e => set('spec_ref', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., IS 456:2000 Cl. 26.2" />
            </div>
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
              <label className="text-xs text-slate-500 font-medium">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Location</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Where on site does this apply?" />
          </div>

          {isEdit && <CommentsSection entityType="rfi" entityId={rfi.id} />}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update RFI' : 'Create RFI'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResponseModal({ rfi, onClose, onSaved }) {
  const [response, setResponse] = useState('');
  const [costImpact, setCostImpact] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!response.trim()) return showWarning('Response is required');
    setSaving(true);
    try {
      await api.patch(`/rfis/${rfi.id}/respond`, { response, cost_impact: costImpact || null, schedule_impact: scheduleImpact || null });
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to submit response');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="text-base font-semibold text-slate-800">Respond to {rfi.rfi_code}</h3>
          <p className="text-xs text-slate-500 mt-1">{rfi.subject}</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-medium mb-1">Question:</p>
            <p className="text-sm text-blue-800">{rfi.question}</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Response *</label>
            <textarea value={response} onChange={e => setResponse(e.target.value)}
              rows={4} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Provide technical response with references" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Cost Impact</label>
              <input type="text" value={costImpact} onChange={e => setCostImpact(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., None / +Rs. 25,000" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Schedule Impact</label>
              <input type="text" value={scheduleImpact} onChange={e => setScheduleImpact(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., None / +3 days" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </div>
    </div>
  );
}
