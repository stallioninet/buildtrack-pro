import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { showError } from '../../utils/toast';
import FilePreviewModal from './FilePreviewModal';
import PhotoMarkup from './PhotoMarkup';

const FILE_ICONS = {
  'application/pdf': { icon: 'PDF', color: 'bg-red-100 text-red-700' },
  'image/jpeg': { icon: 'JPG', color: 'bg-green-100 text-green-700' },
  'image/png': { icon: 'PNG', color: 'bg-green-100 text-green-700' },
  'image/gif': { icon: 'GIF', color: 'bg-green-100 text-green-700' },
  'image/webp': { icon: 'WEBP', color: 'bg-green-100 text-green-700' },
  'image/svg+xml': { icon: 'SVG', color: 'bg-purple-100 text-purple-700' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'DOCX', color: 'bg-blue-100 text-blue-700' },
  'application/msword': { icon: 'DOC', color: 'bg-blue-100 text-blue-700' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'XLSX', color: 'bg-emerald-100 text-emerald-700' },
  'application/vnd.ms-excel': { icon: 'XLS', color: 'bg-emerald-100 text-emerald-700' },
  'text/csv': { icon: 'CSV', color: 'bg-emerald-100 text-emerald-700' },
  'text/plain': { icon: 'TXT', color: 'bg-slate-100 text-slate-600' },
  'application/zip': { icon: 'ZIP', color: 'bg-amber-100 text-amber-700' },
};

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'report', label: 'Report' },
  { value: 'approval', label: 'Approval' },
  { value: 'specification', label: 'Specification' },
  { value: 'photo', label: 'Photo' },
  { value: 'contract', label: 'Contract' },
];

const CATEGORY_COLORS = {
  drawing: 'bg-indigo-100 text-indigo-700',
  report: 'bg-blue-100 text-blue-700',
  approval: 'bg-green-100 text-green-700',
  specification: 'bg-purple-100 text-purple-700',
  photo: 'bg-amber-100 text-amber-700',
  contract: 'bg-rose-100 text-rose-700',
  general: 'bg-slate-100 text-slate-600',
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType, fileName) {
  if (FILE_ICONS[mimeType]) return FILE_ICONS[mimeType];
  const ext = fileName?.split('.').pop()?.toUpperCase();
  if (['DWG', 'DXF'].includes(ext)) return { icon: ext, color: 'bg-orange-100 text-orange-700' };
  if (['SKP'].includes(ext)) return { icon: ext, color: 'bg-yellow-100 text-yellow-700' };
  if (['RVT', '3DS'].includes(ext)) return { icon: ext, color: 'bg-cyan-100 text-cyan-700' };
  if (['PPTX', 'PPT'].includes(ext)) return { icon: ext, color: 'bg-orange-100 text-orange-700' };
  return { icon: ext || 'FILE', color: 'bg-slate-100 text-slate-600' };
}

function isPreviewable(mimeType) {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

function isImage(mimeType) {
  return mimeType?.startsWith('image/');
}

export default function TaskAttachments({ taskId, taskTitle, onClose, initialTab }) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState(initialTab === 'photos' ? 'photo' : 'general');
  const [dragActive, setDragActive] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [markupAttachment, setMarkupAttachment] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [tab, setTab] = useState(initialTab === 'photos' ? 'photos' : 'files');
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const canUpload = ['pm', 'engineer', 'owner', 'contractor', 'inspector'].includes(user?.role);
  const canDelete = ['pm', 'engineer', 'owner'].includes(user?.role);

  const loadAttachments = () => {
    api.get(`/tasks/${taskId}/attachments`)
      .then(setAttachments)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const handleUpload = async (files, uploadCategory) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      await api.upload(`/tasks/${taskId}/attachments`, files, uploadCategory || category);
      loadAttachments();
    } catch (err) {
      showError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e) => {
    handleUpload(Array.from(e.target.files));
  };

  const handlePhotoSelect = (e) => {
    handleUpload(Array.from(e.target.files), 'photo');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    // Auto-detect: if all dropped files are images, set category to photo
    const allImages = files.every(f => f.type.startsWith('image/'));
    handleUpload(files, allImages && tab === 'photos' ? 'photo' : undefined);
  };

  const handleDelete = async (attId, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/tasks/attachments/${attId}`);
      loadAttachments();
    } catch (err) {
      showError(err.message || 'Delete failed');
    }
  };

  const handleView = (att, idx) => {
    setPreviewAttachment(att);
    setPreviewIndex(idx ?? -1);
  };

  const handleDownload = (att) => {
    const link = document.createElement('a');
    link.href = `/api/tasks/attachments/${att.id}/download`;
    link.download = att.original_name;
    link.click();
  };

  // Separate photos and files
  const photos = attachments.filter(a => isImage(a.mime_type));
  const nonPhotos = attachments.filter(a => !isImage(a.mime_type));

  // Group non-photos by category
  const grouped = {};
  for (const att of nonPhotos) {
    const cat = att.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(att);
  }

  // File preview navigation — works in both photo and file contexts
  const previewList = tab === 'photos' ? photos : nonPhotos;
  const navigatePreview = (direction) => {
    const newIdx = previewIndex + direction;
    if (newIdx >= 0 && newIdx < previewList.length) {
      setPreviewAttachment(previewList[newIdx]);
      setPreviewIndex(newIdx);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Documents & Photos</h2>
            <p className="text-xs text-slate-500 mt-0.5">{taskTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-5 flex-shrink-0">
          <div className="flex gap-0">
            {[
              { key: 'photos', label: 'Photos', count: photos.length, icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )},
              { key: 'files', label: 'Files', count: nonPhotos.length, icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )},
            ].map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  if (t.key === 'photos') setCategory('photo');
                  else if (category === 'photo') setCategory('general');
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.icon}
                {t.label}
                <span className="text-xs text-slate-400">({t.count})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ===== PHOTOS TAB ===== */}
          {tab === 'photos' && (
            <>
              {/* Photo upload */}
              {canUpload && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {uploading ? 'Uploading...' : 'Add Photos'}
                  </button>
                  <button
                    onClick={() => {
                      // Create a temporary input with capture attribute for mobile camera
                      const inp = document.createElement('input');
                      inp.type = 'file';
                      inp.accept = 'image/*';
                      inp.capture = 'environment';
                      inp.multiple = true;
                      inp.onchange = (e) => handleUpload(Array.from(e.target.files), 'photo');
                      inp.click();
                    }}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-blue-200 text-blue-600 text-sm rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Take Photo
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <span className="text-xs text-slate-400 ml-auto">JPG, PNG, WebP, GIF</span>
                </div>
              )}

              {/* Drop zone for photos */}
              {canUpload && (
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                    dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <p className="text-xs text-slate-400">Drop images here to upload</p>
                </div>
              )}

              {/* Photo gallery grid */}
              {loading ? (
                <div className="text-center py-8 text-slate-400 text-sm">Loading photos...</div>
              ) : photos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <svg className="w-16 h-16 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-500">No photos yet</p>
                  <p className="text-xs text-slate-400 mt-1">Upload site photos, progress images, or inspection evidence</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo, idx) => (
                    <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                      onClick={() => handleView(photo, idx)}>
                      <img
                        src={`/api/tasks/attachments/${photo.id}/view`}
                        alt={photo.original_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                        <div className="w-full p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[11px] text-white truncate font-medium">{photo.original_name}</p>
                          <p className="text-[10px] text-white/70">{formatFileSize(photo.file_size)} · {photo.uploaded_by_name}</p>
                        </div>
                      </div>
                      {/* Markup button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMarkupAttachment(photo); }}
                        className="absolute top-1.5 left-1.5 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
                        title="Annotate / Markup"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      {(canDelete || photo.uploaded_by === user?.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(photo.id, photo.original_name); }}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== FILES TAB ===== */}
          {tab === 'files' && (
            <>
              {/* Upload area */}
              {canUpload && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {CATEGORIES.filter(c => c.value !== 'photo').map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">Max 25MB per file</span>
                  </div>

                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
                      ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="text-blue-600">
                        <svg className="animate-spin h-6 w-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-sm font-medium">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-slate-600 font-medium">Drop files here or click to browse</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, AutoCAD (DWG/DXF), Office docs, ZIP</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv,.dwg,.dxf,.skp,.3ds,.rvt"
                    />
                  </div>
                </div>
              )}

              {/* File list */}
              {loading ? (
                <div className="text-center py-8 text-slate-400 text-sm">Loading files...</div>
              ) : nonPhotos.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">No documents uploaded yet</p>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, files]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.general}`}>
                        {cat}
                      </span>
                      <span className="text-xs text-slate-400">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1.5">
                      {files.map(att => {
                        const fi = getFileIcon(att.mime_type, att.original_name);
                        return (
                          <div key={att.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 hover:bg-slate-50 group">
                            <span className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${fi.color}`}>
                              {fi.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 font-medium truncate">{att.original_name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{formatFileSize(att.file_size)}</span>
                                <span>by {att.uploaded_by_name}</span>
                                <span>{new Date(att.uploaded_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { const idx = nonPhotos.indexOf(att); handleView(att, idx >= 0 ? idx : -1); }} title="Preview"
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDownload(att)} title="Download"
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                              {(canDelete || att.uploaded_by === user?.id) && (
                                <button onClick={() => handleDelete(att.id, att.original_name)} title="Delete"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* File preview modal */}
        {previewAttachment && (
          <FilePreviewModal
            attachment={previewAttachment}
            onClose={() => { setPreviewAttachment(null); setPreviewIndex(-1); }}
            onPrev={previewIndex > 0 ? () => navigatePreview(-1) : undefined}
            onNext={previewIndex >= 0 && previewIndex < previewList.length - 1 ? () => navigatePreview(1) : undefined}
            currentIndex={previewIndex >= 0 ? previewIndex : undefined}
            totalCount={previewIndex >= 0 ? previewList.length : undefined}
          />
        )}

        {/* Photo markup modal */}
        {markupAttachment && (
          <PhotoMarkup
            imageUrl={`/api/tasks/attachments/${markupAttachment.id}/view`}
            attachmentId={markupAttachment.id}
            onClose={() => setMarkupAttachment(null)}
            onSaved={() => setMarkupAttachment(null)}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 flex-shrink-0">
          <span className="text-xs text-slate-400">{photos.length} photos, {nonPhotos.length} files</span>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Close</button>
        </div>
      </div>
    </div>
  );
}
