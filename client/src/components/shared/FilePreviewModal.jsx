import { useState, useEffect, useCallback, memo } from 'react';
import { api } from '../../api/client';

const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getFileExt(name) {
  return name?.split('.').pop()?.toLowerCase() || '';
}

function getPreviewType(mimeType, fileName) {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  const ext = getFileExt(fileName);
  const textExts = ['txt', 'csv', 'json', 'xml', 'html', 'log', 'md'];
  const textMimes = ['text/plain', 'text/csv', 'text/html', 'application/json', 'text/xml', 'application/xml'];
  if (textMimes.includes(mimeType) || textExts.includes(ext)) return 'text';
  const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  if (officeExts.includes(ext)) return 'office';
  return 'unsupported';
}

const FILE_TYPE_LABELS = {
  image: 'Image',
  pdf: 'PDF Document',
  text: 'Text File',
  office: 'Office Document',
  unsupported: 'File',
};

function ImagePreview({ src, alt }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(prev => Math.min(5, Math.max(0.5, prev + (e.deltaY > 0 ? -0.15 : 0.15))));
  }, []);

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setDragging(false);

  const resetZoom = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 rounded-lg shadow-sm border border-slate-200 p-1">
        <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-sm font-bold">-</button>
        <button onClick={resetZoom}
          className="px-2 h-7 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-100 rounded min-w-[48px]">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-sm font-bold">+</button>
      </div>
      <div
        className="flex-1 overflow-hidden flex items-center justify-center bg-[#1a1a1a] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMyMjIiLz48L3N2Zz4=')]"
        style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none transition-transform"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

function PdfPreview({ src }) {
  return (
    <div className="flex-1 bg-slate-100">
      <iframe
        src={src}
        className="w-full h-full border-0"
        title="PDF Preview"
      />
    </div>
  );
}

function TextPreview({ attachmentId, viewUrl }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Try text endpoint for task attachments, fall back to fetching the raw view URL
    api.get(`/tasks/attachments/${attachmentId}/text`)
      .then(data => setContent(data.content))
      .catch(() => {
        // Fallback: fetch the view URL directly as text
        return fetch(viewUrl, { credentials: 'include' })
          .then(r => r.text())
          .then(text => setContent(text.substring(0, 500000)));
      })
      .catch(err => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [attachmentId, viewUrl]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading file content...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-red-500 text-sm">Failed to load: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-900 p-4">
      <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </pre>
    </div>
  );
}

function OfficePreview({ fileName, downloadUrl }) {
  const ext = getFileExt(fileName).toUpperCase();
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 max-w-sm">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center">
          <span className="text-2xl font-bold text-blue-600">{ext}</span>
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-2">{fileName}</h3>
        <p className="text-sm text-slate-500 mb-4">
          Office documents cannot be previewed directly in the browser. Download the file to view it in the appropriate application.
        </p>
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download {ext}
        </a>
      </div>
    </div>
  );
}

function UnsupportedPreview({ fileName, downloadUrl }) {
  const ext = getFileExt(fileName).toUpperCase();
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 max-w-sm">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-500">{ext || 'FILE'}</span>
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-2">{fileName}</h3>
        <p className="text-sm text-slate-500 mb-4">
          This file type cannot be previewed in the browser.
        </p>
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>
    </div>
  );
}

/**
 * FilePreviewModal — full-featured file preview supporting:
 * - Images (with zoom/pan)
 * - PDFs (embedded viewer)
 * - Text/CSV/JSON files (syntax display)
 * - Office docs (download prompt)
 * - Other files (download prompt)
 *
 * Props:
 *  - attachment: { id, original_name, mime_type, file_size, uploaded_by_name, uploaded_at }
 *  - onClose: () => void
 *  - onPrev / onNext: optional navigation callbacks (for gallery mode)
 *  - currentIndex / totalCount: optional position indicators
 */
function FilePreviewModal({ attachment, onClose, onPrev, onNext, currentIndex, totalCount }) {
  const previewType = getPreviewType(attachment.mime_type, attachment.original_name);
  const isDocument = attachment._isDocument;
  const viewUrl = isDocument
    ? `${BASE}/documents/${attachment.id}/file`
    : `${BASE}/tasks/attachments/${attachment.id}/view`;
  const downloadUrl = isDocument
    ? `${BASE}/documents/${attachment.id}/download`
    : `${BASE}/tasks/attachments/${attachment.id}/download`;

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                previewType === 'image' ? 'bg-green-100 text-green-700' :
                previewType === 'pdf' ? 'bg-red-100 text-red-700' :
                previewType === 'text' ? 'bg-slate-100 text-slate-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {FILE_TYPE_LABELS[previewType]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{attachment.original_name}</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {attachment.file_size && <span>{formatSize(attachment.file_size)}</span>}
                {attachment.uploaded_by_name && <span>by {attachment.uploaded_by_name}</span>}
                {attachment.uploaded_at && <span>{new Date(attachment.uploaded_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {currentIndex !== undefined && totalCount && (
              <span className="text-xs text-slate-400 mr-2">{currentIndex + 1} / {totalCount}</span>
            )}
            <a
              href={downloadUrl}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Previous navigation */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {previewType === 'image' && <ImagePreview src={viewUrl} alt={attachment.original_name} />}
          {previewType === 'pdf' && <PdfPreview src={viewUrl} />}
          {previewType === 'text' && <TextPreview attachmentId={attachment.id} viewUrl={viewUrl} />}
          {previewType === 'office' && <OfficePreview fileName={attachment.original_name} downloadUrl={downloadUrl} />}
          {previewType === 'unsupported' && <UnsupportedPreview fileName={attachment.original_name} downloadUrl={downloadUrl} />}

          {/* Next navigation */}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default memo(FilePreviewModal);
