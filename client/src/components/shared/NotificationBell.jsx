import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { formatDate } from '../../utils/formatters';

const ENTITY_PATHS = {
  task: '/tasks',
  ncr: '/ncrs',
  rfi: '/rfis',
  change_order: '/change-orders',
  document: '/documents',
  submittal: '/submittals',
  punch_item: '/punch-lists',
  safety_permit: '/safety',
  safety_incident: '/safety',
  expense: '/expenses',
  payment: '/payments',
  vendor: '/vendors',
};

const TYPE_ICONS = {
  comment: '💬',
  task_assigned: '📋',
  status_change: '🔄',
  ncr_escalation: '⚠️',
  rfi_due_soon: '⏰',
  document_approval: '📄',
  safety_alert: '🛡️',
};

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const eventSourceRef = useRef(null);

  const loadNotifications = useCallback(() => {
    api.get('/notifications?unread_only=false').then(setNotifications).catch(() => {});
    api.get('/notifications/count').then(d => setUnreadCount(d.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications();

    // Set up SSE connection
    const apiBase = (import.meta.env.VITE_API_URL || '') + '/api';
    const es = new EventSource(`${apiBase}/notifications/stream`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
        }
      } catch (_) {}
    };

    es.onerror = () => {
      // SSE disconnected — fall back to polling
      es.close();
      eventSourceRef.current = null;
    };

    // Fallback polling in case SSE fails
    const interval = setInterval(() => {
      if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
        loadNotifications();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  const handleNotificationClick = useCallback(async (n) => {
    // Mark as read
    if (!n.is_read) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    // Navigate to entity
    const path = ENTITY_PATHS[n.entity_type];
    if (path) {
      navigate(path);
      setOpen(false);
    }
  }, [navigate]);

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button aria-label="Notifications" onClick={toggleOpen} className="relative p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span aria-live="polite" className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications panel" className="absolute right-0 top-10 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50 max-h-96 flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-blue-600 hover:text-blue-800">Mark all read</button>
              )}
              <button onClick={() => { navigate('/profile?tab=notifications'); setOpen(false); }} className="text-[10px] text-slate-400 hover:text-slate-600" title="Notification settings">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`px-3 py-2.5 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5 flex-shrink-0">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700">{n.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatDate(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(NotificationBell);
