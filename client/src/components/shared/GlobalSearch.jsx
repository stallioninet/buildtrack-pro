import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../api/client';
import { TIMING } from '../../config/timing';

const ENTITY_ICONS = {
  task: '☑', stage: '◈', ncr: '⚠', rfi: '?', change_order: '⟳', permit: '🛡',
  incident: '⚡', ra_bill: '₹', document: '📄', submittal: '📋', meeting: '🗓',
  vendor: '🏪', expense: '💳', defect: '🔧',
};

const ENTITY_COLORS = {
  task: 'text-blue-600 bg-blue-50', stage: 'text-indigo-600 bg-indigo-50',
  ncr: 'text-red-600 bg-red-50', rfi: 'text-amber-600 bg-amber-50',
  change_order: 'text-purple-600 bg-purple-50', permit: 'text-green-600 bg-green-50',
  incident: 'text-orange-600 bg-orange-50', ra_bill: 'text-emerald-600 bg-emerald-50',
  document: 'text-cyan-600 bg-cyan-50', submittal: 'text-teal-600 bg-teal-50',
  meeting: 'text-violet-600 bg-violet-50', vendor: 'text-slate-600 bg-slate-50',
  expense: 'text-pink-600 bg-pink-50', defect: 'text-rose-600 bg-rose-50',
};

export default function GlobalSearch() {
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        setResults([]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const search = useCallback((q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const url = `/search?q=${encodeURIComponent(q)}${currentProject?.id ? `&project_id=${currentProject.id}` : ''}`;
    api.get(url).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
  }, [currentProject?.id]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), TIMING.SEARCH_DEBOUNCE_MS);
  };

  const handleSelect = (result) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(result.path);
  };

  // Group results by entity type
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.entity_type]) grouped[r.entity_type] = [];
    grouped[r.entity_type].push(r);
  }

  return (
    <>
      {/* Search trigger button */}
      <button role="search" onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search...</span>
        <kbd className="hidden sm:inline text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">⌘K</kbd>
      </button>

      {/* Search Modal */}
      {open && (
        <div role="dialog" aria-label="Global search" className="fixed inset-0 bg-black/40 flex items-start justify-center z-[60] pt-[15vh]">
          <div ref={containerRef} className="bg-white rounded-xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input ref={inputRef} type="text" value={query} onChange={handleChange}
                aria-label="Search all entities"
                placeholder="Search tasks, NCRs, RFIs, documents, meetings..."
                className="flex-1 text-sm text-slate-800 outline-none placeholder-slate-400" />
              {loading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
              <kbd className="text-[9px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-slate-400">ESC</kbd>
            </div>

            {/* Results */}
            <div role="listbox" className="max-h-[50vh] overflow-y-auto">
              {query.trim().length < 2 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Type at least 2 characters to search across all modules
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  No results found for "{query}"
                </div>
              ) : (
                Object.entries(grouped).map(([type, items]) => (
                  <div key={type}>
                    <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-medium text-slate-400 uppercase tracking-wider sticky top-0">
                      {type.replace(/_/g, ' ')} ({items.length})
                    </div>
                    {items.map((item, i) => (
                      <button role="option" key={`${type}-${i}`} onClick={() => handleSelect(item)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${ENTITY_COLORS[type] || 'bg-slate-50 text-slate-600'}`}>
                          {ENTITY_ICONS[type] || '•'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {item.code && <span className="text-[10px] font-mono text-slate-400">{item.code}</span>}
                            <span className="text-xs font-medium text-slate-700 truncate">{item.title}</span>
                          </div>
                        </div>
                        {item.status && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">{item.status}</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>↵ Open</span>
                <span>ESC Close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
