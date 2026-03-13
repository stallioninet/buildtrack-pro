import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import { showError, showWarning, showSuccess } from '../utils/toast';
import CommentsSection from '../components/shared/CommentsSection';
import Pagination from '../components/ui/Pagination';
import FilePreviewModal from '../components/shared/FilePreviewModal';
import { DOCUMENT_STATUS_COLORS as STATUS_COLORS } from '../config/constants';
import { SkeletonTable } from '../components/ui/Skeleton';

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
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', status: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [stages, setStages] = useState([]);

  const canCreate = ['owner', 'pm', 'engineer'].includes(user?.role);
  const canChangeStatus = ['owner', 'pm', 'engineer'].includes(user?.role);
  const canDelete = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    const params = `project_id=${pid}${filter.category ? `&category=${filter.category}` : ''}${filter.status ? `&status=${filter.status}` : ''}&page=${page}&limit=50`;
    Promise.all([
      api.get(`/documents?${params}`),
      api.get(`/documents/summary?project_id=${pid}`),
    ]).then(([docsData, summaryData]) => {
      if (docsData && docsData.data) {
        setDocuments(docsData.data);
        setPagination(docsData.pagination);
      } else {
        setDocuments(Array.isArray(docsData) ? docsData : []);
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

  const handleStatusChange = async (doc, newStatus) => {
    try {
      await api.patch(`/documents/${doc.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete document ${doc.doc_code}?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to delete document');
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
        <select value={filter.category} onChange={e => { setFilter(f => ({ ...f, category: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Documents List */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No documents found</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
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
                    {doc.file_name ? (
                      <span className="text-blue-500 flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {doc.original_name}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic">No file</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.file_name && doc.mime_type?.startsWith('image/') && (
                    <button
                      onClick={() => navigate(`/documents/${doc.id}/viewer`)}
                      title="Open in Drawing Viewer with pins"
                      className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                  {doc.file_name && (
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      title="Preview file"
                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  )}
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
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
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
          onPreview={(doc) => { setShowModal(false); setSelectedDoc(null); setPreviewDoc(doc); }}
        />
      )}

      {/* File Preview Modal */}
      {previewDoc && previewDoc.file_name && (
        <FilePreviewModal
          attachment={{
            id: previewDoc.id,
            original_name: previewDoc.original_name,
            mime_type: previewDoc.mime_type,
            file_size: previewDoc.file_size,
            uploaded_by_name: previewDoc.uploaded_by_name,
            uploaded_at: previewDoc.updated_at,
            // Use document file endpoints instead of task attachment endpoints
            _isDocument: true,
          }}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

function DocumentModal({ doc, projectId, stages, onClose, onSaved, onPreview }) {
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
  const [uploading, setUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState(doc?.original_name || null);
  const [showRevise, setShowRevise] = useState(false);
  const [newRevision, setNewRevision] = useState('');
  const [newRevisionDate, setNewRevisionDate] = useState('');
  const [revisionDescription, setRevisionDescription] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isEdit) return;
    setUploading(true);
    try {
      await api.upload(`/documents/${doc.id}/upload`, [file]);
      setCurrentFile(file.name);
      showSuccess('File uploaded successfully');
    } catch (err) {
      showError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return showWarning('Title is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/documents/${doc.id}`, form);
      } else {
        await api.post('/documents', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleRevise = async () => {
    if (!newRevision.trim()) return showWarning('Revision number is required');
    setSaving(true);
    try {
      await api.patch(`/documents/${doc.id}/revise`, {
        revision: newRevision,
        revision_date: newRevisionDate || null,
        description: revisionDescription || null,
      });
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to create revision');
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

          {/* File Upload Section (edit mode only) */}
          {isEdit && (
            <div className="border-t pt-4 mt-2">
              <label className="text-xs text-slate-500 font-medium">Attached File</label>
              <div className="mt-1.5 flex items-center gap-3">
                {currentFile ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-slate-700 truncate">{currentFile}</span>
                    {doc.file_name && (
                      <button
                        onClick={() => onPreview({ ...doc, original_name: currentFile })}
                        className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
                      >
                        Preview
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 italic">No file attached</span>
                )}
                <label className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer flex-shrink-0 ${
                  uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}>
                  {uploading ? 'Uploading...' : currentFile ? 'Replace File' : 'Upload File'}
                  <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv,.dwg,.dxf,.skp,.3ds,.rvt,.jpg,.jpeg,.png,.gif,.webp" />
                </label>
              </div>
            </div>
          )}

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
