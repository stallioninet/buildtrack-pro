import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { showError } from '../../utils/toast';

const TOOLS = [
  { id: 'pen', label: 'Pen', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { id: 'arrow', label: 'Arrow', icon: 'M5 10l7-7m0 0l7 7m-7-7v18' },
  { id: 'rectangle', label: 'Rect', icon: 'M4 6h16v12H4z' },
  { id: 'circle', label: 'Circle', icon: 'M12 12m-9 0a9 9 0 1018 0a9 9 0 10-18 0' },
  { id: 'text', label: 'Text', icon: 'M4 6h16M8 6v12m8-12v12M6 18h4m4 0h4' },
];

const COLORS = [
  { id: 'red', value: '#ef4444' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'green', value: '#22c55e' },
  { id: 'yellow', value: '#eab308' },
  { id: 'white', value: '#ffffff' },
];

const WIDTHS = [
  { id: 'thin', value: 2, label: 'Thin' },
  { id: 'medium', value: 4, label: 'Med' },
  { id: 'thick', value: 6, label: 'Thick' },
];

export default function PhotoMarkup({ imageUrl, attachmentId, onClose, onSaved }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);

  const [activeTool, setActiveTool] = useState('pen');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [activeWidth, setActiveWidth] = useState(4);
  const [annotations, setAnnotations] = useState([]);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image and set canvas dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      fitCanvas(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      showError('Failed to load image');
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const fitCanvas = useCallback((img) => {
    const maxW = window.innerWidth - 32;
    const maxH = window.innerHeight - 120;
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.floor(img.width * ratio);
    const h = Math.floor(img.height * ratio);
    setCanvasSize({ width: w, height: h });
  }, []);

  // Load existing annotations
  useEffect(() => {
    if (!attachmentId) return;
    api.get(`/attachments/${attachmentId}/annotations`)
      .then((data) => {
        if (data && data.annotation_data) {
          try {
            const parsed = JSON.parse(data.annotation_data);
            if (Array.isArray(parsed)) setAnnotations(parsed);
          } catch { /* ignore parse errors */ }
        }
      })
      .catch(() => { /* no existing annotations, that's fine */ });
  }, [attachmentId]);

  // Redraw canvas whenever annotations or current stroke changes
  useEffect(() => {
    redrawCanvas();
  }, [annotations, currentAnnotation, canvasSize, imageLoaded]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw all saved annotations
    for (const ann of annotations) {
      drawAnnotation(ctx, ann);
    }

    // Draw current in-progress annotation
    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation);
    }
  }, [annotations, currentAnnotation, canvasSize, imageLoaded]);

  function drawAnnotation(ctx, ann) {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (ann.tool) {
      case 'pen':
        if (ann.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        ctx.stroke();
        break;

      case 'arrow': {
        if (ann.points.length < 2) return;
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        // Line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = 12 + ann.width * 2;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle - Math.PI / 6),
          end.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle + Math.PI / 6),
          end.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      }

      case 'rectangle': {
        if (ann.points.length < 2) return;
        const s = ann.points[0];
        const e = ann.points[ann.points.length - 1];
        ctx.beginPath();
        ctx.rect(s.x, s.y, e.x - s.x, e.y - s.y);
        ctx.stroke();
        break;
      }

      case 'circle': {
        if (ann.points.length < 2) return;
        const s = ann.points[0];
        const e = ann.points[ann.points.length - 1];
        const cx = (s.x + e.x) / 2;
        const cy = (s.y + e.y) / 2;
        const rx = Math.abs(e.x - s.x) / 2;
        const ry = Math.abs(e.y - s.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'text': {
        if (!ann.text || ann.points.length < 1) return;
        const fontSize = 14 + ann.width * 2;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillText(ann.text, ann.points[0].x, ann.points[0].y);
        break;
      }
    }
  }

  function getCanvasPos(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const pos = getCanvasPos(e);

    if (activeTool === 'text') {
      const text = prompt('Enter annotation text:');
      if (text) {
        setAnnotations((prev) => [
          ...prev,
          { tool: 'text', points: [pos], color: activeColor, width: activeWidth, text },
        ]);
      }
      return;
    }

    isDrawingRef.current = true;
    setCurrentAnnotation({
      tool: activeTool,
      points: [pos],
      color: activeColor,
      width: activeWidth,
      text: null,
    });
  }

  function handlePointerMove(e) {
    if (!isDrawingRef.current || !currentAnnotation) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    setCurrentAnnotation((prev) => {
      if (!prev) return prev;
      if (prev.tool === 'pen') {
        return { ...prev, points: [...prev.points, pos] };
      }
      // For arrow, rectangle, circle: keep start point, update end
      return { ...prev, points: [prev.points[0], pos] };
    });
  }

  function handlePointerUp(e) {
    if (!isDrawingRef.current || !currentAnnotation) return;
    e.preventDefault();
    isDrawingRef.current = false;

    // Only save if there was meaningful movement
    if (currentAnnotation.points.length >= 2) {
      setAnnotations((prev) => [...prev, currentAnnotation]);
    }
    setCurrentAnnotation(null);
  }

  function handleUndo() {
    setAnnotations((prev) => prev.slice(0, -1));
  }

  function handleClearAll() {
    setAnnotations([]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post(`/attachments/${attachmentId}/annotations`, {
        attachment_id: attachmentId,
        annotation_data: JSON.stringify(annotations),
      });
      if (onSaved) onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save annotations');
    } finally {
      setSaving(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center">
      {/* Toolbar */}
      <div className="w-full bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center gap-2 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1 border-r border-gray-600 pr-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`p-2 rounded text-xs font-medium transition-colors ${
                activeTool === tool.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={tool.label}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
              </svg>
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 border-r border-gray-600 pr-2">
          {COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => setActiveColor(color.value)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                activeColor === color.value ? 'border-white scale-125' : 'border-gray-500'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.id}
            />
          ))}
        </div>

        {/* Line width */}
        <div className="flex items-center gap-1 border-r border-gray-600 pr-2">
          {WIDTHS.map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveWidth(w.value)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeWidth === w.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={`${w.label} (${w.value}px)`}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={handleUndo}
            disabled={annotations.length === 0}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo
          </button>
          <button
            onClick={handleClearAll}
            disabled={annotations.length === 0}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-red-600 hover:text-white ml-1"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-4"
      >
        {!imageLoaded ? (
          <div className="text-gray-400 text-sm">Loading image...</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              cursor: activeTool === 'text' ? 'text' : 'crosshair',
            }}
            className="rounded shadow-lg"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        )}
      </div>
    </div>
  );
}
