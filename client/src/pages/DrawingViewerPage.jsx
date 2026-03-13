import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

const PIN_TYPES = [
  { value: 'note', label: 'Note', icon: 'N', color: '#3b82f6' },
  { value: 'issue', label: 'Issue', icon: '!', color: '#ef4444' },
  { value: 'rfi', label: 'RFI', icon: 'R', color: '#f59e0b' },
  { value: 'approval', label: 'Approval', icon: '\u2713', color: '#10b981' },
  { value: 'dimension', label: 'Dimension', icon: 'D', color: '#8b5cf6' },
  { value: 'safety', label: 'Safety', icon: 'S', color: '#f97316' },
];

const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700' },
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-700' },
];

function getPinColor(pin) {
  if (pin.status === 'resolved') return '#6b7280';
  const pt = PIN_TYPES.find(t => t.value === pin.pin_type);
  return pt?.color || '#3b82f6';
}

function getPinIcon(pin) {
  const pt = PIN_TYPES.find(t => t.value === pin.pin_type);
  return pt?.icon || 'N';
}

export default function DrawingViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doc, setDoc] = useState(null);
  const [pins, setPins] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Viewer state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Pin interaction state
  const [mode, setMode] = useState('view'); // 'view' | 'place'
  const [placePinType, setPlacePinType] = useState('note');
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPinForm, setShowPinForm] = useState(null); // { x, y } for new, or pin object for edit
  const [pinFilter, setPinFilter] = useState('all'); // 'all' | 'open' | 'resolved'
  const [showPinList, setShowPinList] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Load document + pins + users
  useEffect(() => {
    Promise.all([
      api.get(`/documents?project_id=&page=1&limit=1`).catch(() => null), // dummy to get project context
      fetch(`${BASE}/documents/${id}/file`, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('File not found');
        return r;
      }),
    ]).catch(() => {});

    api.get(`/documents?page=1&limit=200`).then(res => {
      const found = res.data?.find(d => d.id === parseInt(id));
      if (found) setDoc(found);
      else setError('Document not found');
    }).catch(() => setError('Failed to load document'));

    api.get(`/documents/${id}/pins`).then(setPins).catch(() => setPins([]));
    api.get('/auth/users').then(setUsers).catch(() => []);

    setLoading(false);
  }, [id]);

  const loadPins = useCallback(() => {
    api.get(`/documents/${id}/pins`).then(setPins).catch(() => {});
  }, [id]);

  // Determine file type
  const isImage = doc?.mime_type?.startsWith('image/');
  const isPdf = doc?.mime_type === 'application/pdf';
  const fileUrl = `${BASE}/documents/${id}/file`;

  // Handle image load to get natural dimensions
  const handleImageLoad = (e) => {
    setImgNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setImageLoaded(true);
  };

  // Zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.min(5, Math.max(0.25, prev + delta)));
  }, []);

  // Pan
  const handleMouseDown = (e) => {
    if (mode === 'place') return;
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setDragging(false);

  // Place a pin by clicking on the image
  const handleImageClick = (e) => {
    if (mode !== 'place' || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    // Calculate percentage position relative to the displayed image
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    setShowPinForm({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, isNew: true });
    setMode('view');
  };

  // Filter pins
  const visiblePins = pins.filter(p => {
    if (pinFilter === 'open') return p.status !== 'resolved';
    if (pinFilter === 'resolved') return p.status === 'resolved';
    return true;
  });

  const canEdit = ['owner', 'pm', 'engineer', 'inspector'].includes(user?.role);

  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-500 mb-4">{error}</p>
      <button onClick={() => navigate('/documents')} className="text-sm text-blue-600 hover:underline">Back to Documents</button>
    </div>
  );

  if (doc && !doc.file_name) return (
    <div className="text-center py-16">
      <p className="text-slate-500 mb-4">This document has no file attached. Upload a file first.</p>
      <button onClick={() => navigate('/documents')} className="text-sm text-blue-600 hover:underline">Back to Documents</button>
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-900 -m-6 -mt-6">
      {/* Top toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/documents')}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">{doc?.doc_code}</span>
              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">{doc?.revision || 'R0'}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{doc?.title}</p>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white rounded text-sm font-bold">-</button>
          <button onClick={resetView} className="px-2 h-7 flex items-center justify-center text-xs text-slate-500 hover:bg-white rounded min-w-[48px]">{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white rounded text-sm font-bold">+</button>
          <button onClick={() => setZoom(z => {
            if (!containerRef.current || !imgNaturalSize) return z;
            const cw = containerRef.current.clientWidth - 40;
            return Math.min(5, cw / imgNaturalSize.w);
          })} className="px-2 h-7 flex items-center justify-center text-xs text-slate-500 hover:bg-white rounded" title="Fit width">
            Fit
          </button>
        </div>

        {/* Pin tools */}
        <div className="flex items-center gap-2">
          {/* Pin filter */}
          <select value={pinFilter} onChange={e => setPinFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="all">All Pins ({pins.length})</option>
            <option value="open">Open ({pins.filter(p => p.status !== 'resolved').length})</option>
            <option value="resolved">Resolved ({pins.filter(p => p.status === 'resolved').length})</option>
          </select>

          {/* Toggle pin list */}
          <button onClick={() => setShowPinList(!showPinList)}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${showPinList ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            List
          </button>

          {canEdit && (
            <>
              <div className="w-px h-6 bg-slate-200" />
              {/* Pin type selector for placing */}
              {mode === 'place' && (
                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                  {PIN_TYPES.map(pt => (
                    <button key={pt.value} onClick={() => setPlacePinType(pt.value)}
                      title={pt.label}
                      className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-colors ${placePinType === pt.value ? 'ring-2 ring-offset-1' : 'hover:bg-white'}`}
                      style={{ color: pt.color, ringColor: pt.color }}>
                      {pt.icon}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setMode(mode === 'place' ? 'view' : 'place')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'place' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {mode === 'place' ? 'Cancel' : 'Add Pin'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Placement mode banner */}
      {mode === 'place' && (
        <div className="flex-shrink-0 bg-blue-600 text-white text-center py-1.5 text-xs font-medium z-10">
          Click anywhere on the drawing to place a <strong>{PIN_TYPES.find(t => t.value === placePinType)?.label}</strong> pin
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Main viewer */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: mode === 'place' ? 'crosshair' : (dragging ? 'grabbing' : 'grab') }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isImage && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
              <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                <img
                  ref={imgRef}
                  src={fileUrl}
                  alt={doc?.title}
                  onLoad={handleImageLoad}
                  onClick={handleImageClick}
                  draggable={false}
                  className="max-w-none select-none"
                  style={{ display: 'block' }}
                />
                {/* Pin overlay on image */}
                {imageLoaded && visiblePins.map(pin => (
                  <PinMarker
                    key={pin.id}
                    pin={pin}
                    isSelected={selectedPin?.id === pin.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPin(selectedPin?.id === pin.id ? null : pin);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {isPdf && (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0 bg-white"
              title={doc?.title}
            />
          )}

          {!isImage && !isPdf && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-700 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-300">{doc?.original_name?.split('.').pop()?.toUpperCase()}</span>
                </div>
                <p className="text-sm text-slate-400 mb-4">Pin annotations are available for image files (JPG, PNG, etc.)</p>
                <a href={`${BASE}/documents/${id}/download`} download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Download File
                </a>
              </div>
            </div>
          )}

          {/* Selected pin tooltip */}
          {selectedPin && isImage && imageLoaded && (
            <PinTooltip
              pin={selectedPin}
              onClose={() => setSelectedPin(null)}
              onEdit={() => { setShowPinForm(selectedPin); setSelectedPin(null); }}
              onStatusChange={async (status) => {
                await api.patch(`/documents/pins/${selectedPin.id}`, { status });
                loadPins();
                setSelectedPin(null);
              }}
              canEdit={canEdit}
              user={user}
              zoom={zoom}
              offset={offset}
              imgRef={imgRef}
            />
          )}
        </div>

        {/* Pin list sidebar */}
        {showPinList && (
          <PinListPanel
            pins={visiblePins}
            selectedPin={selectedPin}
            onSelect={(pin) => setSelectedPin(pin)}
            onEdit={(pin) => { setShowPinForm(pin); setSelectedPin(null); }}
            onDelete={async (pin) => {
              if (!confirm(`Delete pin "${pin.title}"?`)) return;
              await api.delete(`/documents/pins/${pin.id}`);
              loadPins();
              if (selectedPin?.id === pin.id) setSelectedPin(null);
            }}
            canEdit={canEdit}
            user={user}
          />
        )}
      </div>

      {/* Pin create/edit form modal */}
      {showPinForm && (
        <PinFormModal
          pin={showPinForm}
          users={users}
          docId={parseInt(id)}
          defaultPinType={placePinType}
          onClose={() => setShowPinForm(null)}
          onSaved={() => { setShowPinForm(null); loadPins(); }}
        />
      )}
    </div>
  );
}

// ── Pin Marker on drawing ─────────────────────────────────────
function PinMarker({ pin, isSelected, onClick }) {
  const color = getPinColor(pin);
  const icon = getPinIcon(pin);
  const resolved = pin.status === 'resolved';

  return (
    <button
      onClick={onClick}
      className="absolute group"
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: 'translate(-50%, -100%)',
        zIndex: isSelected ? 50 : 10,
      }}
      title={pin.title}
    >
      {/* Pin shape */}
      <div className={`relative transition-transform ${isSelected ? 'scale-125' : 'group-hover:scale-110'}`}>
        <svg width="28" height="36" viewBox="0 0 28 36" className="drop-shadow-md">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
            fill={color} opacity={resolved ? 0.5 : 1} />
          <circle cx="14" cy="13" r="8" fill="white" opacity="0.9" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold pb-2"
          style={{ color }}>{icon}</span>
      </div>
      {/* Label on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        <span className="text-[10px] bg-black/80 text-white px-1.5 py-0.5 rounded">{pin.title}</span>
      </div>
    </button>
  );
}

// ── Pin Tooltip (appears when selected) ───────────────────────
function PinTooltip({ pin, onClose, onEdit, onStatusChange, canEdit, user, zoom, offset, imgRef }) {
  const tooltipRef = useRef(null);

  // Position tooltip near the pin
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const px = rect.left + (pin.x / 100) * rect.width;
    const py = rect.top + (pin.y / 100) * rect.height;
    setPos({ left: px + 16, top: py - 20 });
  }, [pin, zoom, offset]);

  const severityOpt = SEVERITY_OPTIONS.find(s => s.value === pin.severity);
  const statusOpt = STATUS_OPTIONS.find(s => s.value === pin.status);

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 w-72 z-[100]"
      style={{ left: pos.left, top: pos.top }}
      onClick={e => e.stopPropagation()}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: getPinColor(pin) }}>
              {getPinIcon(pin)}
            </span>
            <span className="text-xs font-medium capitalize text-slate-500">{pin.pin_type}</span>
            {severityOpt && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${severityOpt.color}`}>
                {severityOpt.label}
              </span>
            )}
            {statusOpt && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusOpt.color}`}>
                {statusOpt.label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h4 className="text-sm font-semibold text-slate-800 mb-1">{pin.title}</h4>
        {pin.description && <p className="text-xs text-slate-500 mb-2 line-clamp-3">{pin.description}</p>}
        <div className="flex flex-col gap-1 text-[11px] text-slate-400">
          <span>By {pin.created_by_name} &middot; {new Date(pin.created_at).toLocaleDateString()}</span>
          {pin.assigned_to_name && <span>Assigned to: <strong className="text-slate-600">{pin.assigned_to_name}</strong></span>}
          {pin.resolved_by_name && <span>Resolved by: {pin.resolved_by_name}</span>}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 p-2 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button onClick={onEdit} className="px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 rounded font-medium">Edit</button>
          {pin.status !== 'resolved' && (
            <button onClick={() => onStatusChange('resolved')} className="px-2 py-1 text-[11px] text-green-600 hover:bg-green-50 rounded font-medium">Resolve</button>
          )}
          {pin.status === 'resolved' && (
            <button onClick={() => onStatusChange('open')} className="px-2 py-1 text-[11px] text-orange-600 hover:bg-orange-50 rounded font-medium">Reopen</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pin list sidebar ──────────────────────────────────────────
function PinListPanel({ pins, selectedPin, onSelect, onEdit, onDelete, canEdit, user }) {
  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Annotations ({pins.length})</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-400">No pins to display</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pins.map(pin => {
              const color = getPinColor(pin);
              const isActive = selectedPin?.id === pin.id;
              const severityOpt = SEVERITY_OPTIONS.find(s => s.value === pin.severity);
              return (
                <div
                  key={pin.id}
                  onClick={() => onSelect(pin)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: color }}>{getPinIcon(pin)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-slate-800 truncate">{pin.title}</span>
                        {severityOpt && pin.severity !== 'info' && (
                          <span className={`text-[9px] px-1 py-0 rounded font-medium ${severityOpt.color}`}>{severityOpt.label}</span>
                        )}
                      </div>
                      {pin.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mb-1">{pin.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{pin.created_by_name}</span>
                        <span>&middot;</span>
                        <span>{new Date(pin.created_at).toLocaleDateString()}</span>
                        {pin.assigned_to_name && (
                          <>
                            <span>&middot;</span>
                            <span className="text-blue-500">{pin.assigned_to_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_OPTIONS.find(s => s.value === pin.status)?.color || 'bg-slate-100 text-slate-600'}`}>
                      {pin.status === 'in_progress' ? 'In Prog' : pin.status}
                    </span>
                  </div>
                  {canEdit && isActive && (
                    <div className="flex items-center gap-1 mt-2 ml-8">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(pin); }} className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100 font-medium">Edit</button>
                      {(pin.created_by === user?.id || ['owner', 'pm'].includes(user?.role)) && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(pin); }} className="px-2 py-0.5 text-[10px] text-red-500 bg-red-50 rounded hover:bg-red-100 font-medium">Delete</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pin create/edit form modal ────────────────────────────────
function PinFormModal({ pin, users, docId, defaultPinType, onClose, onSaved }) {
  const isNew = pin.isNew;
  const [form, setForm] = useState({
    title: isNew ? '' : pin.title || '',
    description: isNew ? '' : pin.description || '',
    pin_type: isNew ? defaultPinType : pin.pin_type || 'note',
    severity: isNew ? 'info' : pin.severity || 'info',
    status: isNew ? 'open' : pin.status || 'open',
    assigned_to: isNew ? '' : pin.assigned_to || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.post(`/documents/${docId}/pins`, {
          x: pin.x,
          y: pin.y,
          ...form,
          assigned_to: form.assigned_to || null,
        });
      } else {
        await api.patch(`/documents/pins/${pin.id}`, {
          ...form,
          assigned_to: form.assigned_to || null,
        });
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          {isNew ? 'New Pin Annotation' : 'Edit Pin'}
        </h3>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-slate-600">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of the annotation" autoFocus />
          </div>

          {/* Pin type + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Type</label>
              <select value={form.pin_type} onChange={e => setForm(f => ({ ...f, pin_type: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1">
                {PIN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1">
                {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Status (edit only) + Assign to */}
          <div className="grid grid-cols-2 gap-3">
            {!isNew && (
              <div>
                <label className="text-xs font-medium text-slate-600">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
            <div className={isNew ? 'col-span-2' : ''}>
              <label className="text-xs font-medium text-slate-600">Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value ? parseInt(e.target.value) : '' }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
              placeholder="Detailed notes, instructions, or context" />
          </div>

          {/* Position display for new pins */}
          {isNew && (
            <p className="text-[11px] text-slate-400">
              Position: ({pin.x.toFixed(1)}%, {pin.y.toFixed(1)}%)
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : isNew ? 'Place Pin' : 'Update Pin'}
          </button>
        </div>
      </div>
    </div>
  );
}
