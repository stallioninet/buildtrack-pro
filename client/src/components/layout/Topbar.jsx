import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../../config/navigation';
import NotificationBell from '../shared/NotificationBell';
import GlobalSearch from '../shared/GlobalSearch';

export default function Topbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const { projects, currentProject, selectProject } = useProject();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const ownerTypeLabel = user?.owner_type === 'firm' ? 'Construction Firm' : user?.role === 'owner' ? 'Home Owner' : '';

  return (
    <header role="banner" aria-label="Top navigation bar" className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-4">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 mr-2" aria-label="Open menu">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {/* Project selector */}
        {currentProject && projects.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-xs font-bold">
                {currentProject.name.charAt(0)}
              </div>
              <div className="text-left">
                <h2 className="text-sm font-semibold text-slate-800 leading-tight">
                  {currentProject.name}
                </h2>
                <p className="text-xs text-slate-400">{currentProject.location || 'No location'}</p>
              </div>
              {projects.length > 1 && (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {showDropdown && projects.length > 1 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1">
                <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Switch Project</div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { selectProject(p); setShowDropdown(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${p.id === currentProject?.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${p.id === currentProject?.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.location || 'No location'} | {p.completion}%</div>
                    </div>
                    {p.id === currentProject?.id && (
                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Separator + user info */}
        {currentProject && <div className="h-8 w-px bg-slate-200" />}
        <div>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS[user?.role] || user?.role}
            {ownerTypeLabel && <span className="text-slate-400"> ({ownerTypeLabel})</span>}
          </p>
          <p className="text-xs text-slate-400">{user?.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <GlobalSearch />
        <NotificationBell />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
