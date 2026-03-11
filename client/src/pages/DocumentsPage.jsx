import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import CommentsSection from '../components/shared/CommentsSection';

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Superseded: 'bg-purple-100 text-purple-700',
  Void: 'bg-slate-200 text-slate-500',
};

const STATUSES = ['Draft', 'Under Review', 'Approved', 'Superseded', 'Void'];
const CATEGORIES = ['Structural', 'Architectural', 'MEP', 'Civil', 'Landscape', 'Interior', 'Safety', 'Specification', 'Report', 'Other'];
const DOC_TYPES = [
  { value: 'drawing', label: 'Drawing' },
  { value: 'specification', label: 'Specification' },
  { value: 'report', label: 'Report' },
  { value: 'submittal', label: 'Submittal' },
  { value: 'manual', label: 'Manual' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS = {
  Structural: 'bg-red-50 text-red-600',
  Architectural: 'bg-blue-50 text-blue-600',
  MEP: 'bg-yellow-50 text-yellow-700',
  Civil: 'bg-orange-50 text-orange-600',
  Landscape: 'bg-green-50 text-green-600',
  Interior: 'bg-pink-50 text-pink-600',
  Safety: 'bg-red-100 text-red-700',
  Specification: 'bg-indigo-50 text-indigo-600',
  Report: 'bg-teal-50 text-teal-600',
  Other: 'bg-slate-50 text-slate-600',
};

export default function DocumentsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [stages, setStages] = useState([]);

  const canCreate = ['owner', 'pm', 'engineer'].includes(user?.role);
  const canChangeStatus = ['owner', 'pm', 'engineer'].includes(user?.role);
  const canDelete = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    const params = `project_id=${pid}${filter.category ? `&category=${filter.category}` : ''}${filter.status ? `&status=${filter.status}` : ''}`;
    Promise.all([
      api.get(`/documents?${params}`),
      api.get(`/documents/summary?project_id=${pid}`),
    ]).then(([docsData, summaryData]) => {
      setDocuments(docsData);
      setSummary(summaryData);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
  }, [currentProject?.id]);

  const handleStatusChange = async (doc, newStatus) => {
    try {
      await api.patch(`/documents/${doc.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete document ${doc.doc_code}?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete document');
    }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents & Drawings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage project drawings, specifications, and document revisions</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelectedDoc(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Document
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Documents" value={summary.total} color="blue" />
          <StatCard
            label="Approved"
            value={summary.byStatus?.find(s => s.status === 'Approved')?.count || 0}
            color="green"
          />
          <StatCard
            label="Under Review"
            value={summary.byStatus?.find(s => s.status === 'Under Review')?.count || 0}
            color="yellow"
          />
          <div className="bg-white rounded-xl border p-4">
            <div className="flex gap-1 flex-wrap">
              {summary.byCategory?.slice(0, 5).map(c => (
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
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No documents found</div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{doc.doc_code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[doc.category] || 'bg-slate-100 text-slate-600'}`}>
                      {doc.category}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[doc.status] || 'bg-slate-100 text-slate-600'}`}>
                      {doc.status}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      {doc.revision || 'R0'}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                    onClick={() => { setSelectedDoc(doc); setShowModal(true); }}>
                    {doc.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                    <span className="capitalize">{doc.doc_type || 'drawing'}</span>
                    {doc.stage_name && <span>{doc.stage_name}</span>}
                    {doc.revision_date && <span>Rev: {formatDate(doc.revision_date)}</span>}
                    {doc.uploaded_by_name && <span>By: {doc.uploaded_by_name}</span>}
                    {doc.approved_by_name && <span className="text-green-600">Approved by: {doc.approved_by_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canChangeStatus && doc.status !== 'Void' && (
                    <select
                      value={doc.status}
                      onChange={e => handleStatusChange(doc, e.target.value)}
                      className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white"
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(doc)}
                      className="text-[10px] text-slate-400 hover:text-red-500 px-1">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Modal */}
      {showModal && (
        <DocumentModal
          doc={selectedDoc}
          projectId={currentProject.id}
          stages={stages}
          onClose={() => { setShowModal(false); setSelectedDoc(null); }}
          onSaved={() => { setShowModal(false); setSelectedDoc(null); loadData(); }}
        />
      )}
    </div>
  );
}

function DocumentModal({ doc, projectId, stages, onClose, onSaved }) {
  const isEdit = !!doc;
  const [form, setForm] = useState({
    title: doc?.title || '',
    category: doc?.category || 'Structural',
    doc_type: doc?.doc_type || 'drawing',
    stage_id: doc?.stage_id || '',
    revision: doc?.revision || 'R0',
    revision_date: doc?.revision_date || '',
    description: doc?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [newRevision, setNewRevision] = useState('');
  const [newRevisionDate, setNewRevisionDate] = useState('');
  const [revisionDescription, setRevisionDescription] = useState('');

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/documents/${doc.id}`, form);
      } else {
        await api.post('/documents', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleRevise = async () => {
    if (!newRevision.trim()) return alert('Revision number is required');
    setSaving(true);
    try {
      await api.patch(`/documents/${doc.id}/revise`, {
        revision: newRevision,
        revision_date: newRevisionDate || null,
        description: revisionDescription || null,
      });
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to create revision');
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
            {isEdit ? `${doc.doc_code} — Edit Document` : 'New Document'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Document or drawing title" />
          </div>

          {/* Row: Category + Doc Type + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Document Type</label>
              <select value={form.doc_type} onChange={e => set('doc_type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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

          {/* Row: Revision + Revision Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Revision</label>
              <input type="text" value={form.revision} onChange={e => set('revision', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., R0, R1, A" disabled={isEdit} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Revision Date</label>
              <input type="date" value={form.revision_date} onChange={e => set('revision_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" disabled={isEdit} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Document description, scope, or notes" />
          </div>

          {/* New Revision Section (edit mode only) */}
          {isEdit && (
            <div className="border-t pt-4 mt-4">
              {!showRevise ? (
                <button onClick={() => setShowRevise(true)}
                  className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium">
                  New Revision
                </button>
              ) : (
                <div className="space-y-3 bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                  <h4 className="text-xs uppercase tracking-wider text-indigo-500 font-semibold">Create New Revision</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 font-medium">New Revision *</label>
                      <input type="text" value={newRevision} onChange={e => setNewRevision(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 bg-white"
                        placeholder="e.g., R1, R2, A" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Revision Date</label>
                      <input type="date" value={newRevisionDate} onChange={e => setNewRevisionDate(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Revision Notes</label>
                    <textarea value={revisionDescription} onChange={e => setRevisionDescription(e.target.value)}
                      rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 bg-white"
                      placeholder="What changed in this revision" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleRevise} disabled={saving}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Submit Revision'}
                    </button>
                    <button onClick={() => setShowRevise(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {isEdit && <CommentsSection entityType="document" entityId={doc.id} />}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Document' : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
