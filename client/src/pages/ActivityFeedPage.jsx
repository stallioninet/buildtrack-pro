import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/ui/Pagination';
import StatCard from '../components/ui/StatCard';
import { SkeletonTable } from '../components/ui/Skeleton';

// ── Entity configuration ──────────────────────────────────────
const ENTITY_CONFIG = {
  task:             { label: 'Task',           icon: '\u2713', bg: 'bg-blue-100',    text: 'text-blue-700',    iconBg: 'bg-blue-500' },
  ncr:              { label: 'NCR',            icon: '!',  bg: 'bg-red-100',     text: 'text-red-700',     iconBg: 'bg-red-500' },
  rfi:              { label: 'RFI',            icon: '?',  bg: 'bg-amber-100',   text: 'text-amber-700',   iconBg: 'bg-amber-500' },
  inspection:       { label: 'Inspection',     icon: '\u2691', bg: 'bg-purple-100',  text: 'text-purple-700',  iconBg: 'bg-purple-500' },
  defect:           { label: 'Defect',         icon: '\u26A0', bg: 'bg-orange-100',  text: 'text-orange-700',  iconBg: 'bg-orange-500' },
  document:         { label: 'Document',       icon: '\u2750', bg: 'bg-indigo-100',  text: 'text-indigo-700',  iconBg: 'bg-indigo-500' },
  change_order:     { label: 'Change Order',   icon: '\u21C4', bg: 'bg-teal-100',    text: 'text-teal-700',    iconBg: 'bg-teal-500' },
  safety_permit:    { label: 'Safety Permit',  icon: '\u26D1', bg: 'bg-yellow-100',  text: 'text-yellow-700',  iconBg: 'bg-yellow-600' },
  safety_incident:  { label: 'Incident',       icon: '\u26A1', bg: 'bg-red-100',     text: 'text-red-700',     iconBg: 'bg-red-600' },
  submittal:        { label: 'Submittal',      icon: '\u2709', bg: 'bg-cyan-100',    text: 'text-cyan-700',    iconBg: 'bg-cyan-500' },
  material:         { label: 'Material',       icon: '\u25A6', bg: 'bg-green-100',   text: 'text-green-700',   iconBg: 'bg-green-500' },
  payment:          { label: 'Payment',        icon: '\u20B9', bg: 'bg-emerald-100', text: 'text-emerald-700', iconBg: 'bg-emerald-500' },
  expense:          { label: 'Expense',        icon: '\u20B9', bg: 'bg-lime-100',    text: 'text-lime-700',    iconBg: 'bg-lime-600' },
  ra_bill:          { label: 'RA Bill',        icon: '\u2263', bg: 'bg-sky-100',     text: 'text-sky-700',     iconBg: 'bg-sky-500' },
  auth:             { label: 'Auth',           icon: '\u26BF', bg: 'bg-slate-100',   text: 'text-slate-600',   iconBg: 'bg-slate-500' },
  punch_item:       { label: 'Punch Item',     icon: '\u2611', bg: 'bg-pink-100',    text: 'text-pink-700',    iconBg: 'bg-pink-500' },
};

const ACTION_LABELS = {
  created: 'created',
  status_change: 'changed status of',
  updated: 'updated',
  deleted: 'deleted',
  approved: 'approved',
  rejected: 'rejected',
  revision: 'revised',
  comment_added: 'commented on',
  comment_deleted: 'deleted comment on',
  files_uploaded: 'uploaded files to',
  file_deleted: 'deleted file from',
  auto_status_change: 'auto-changed status of',
  login: 'logged in',
  logout: 'logged out',
  register: 'registered',
  password_change: 'changed password',
  profile_updated: 'updated profile',
  team_member_created: 'created team member',
  team_member_updated: 'updated team member',
};

function getEntityConfig(entity) {
  return ENTITY_CONFIG[entity] || { label: entity, icon: '\u2022', bg: 'bg-slate-100', text: 'text-slate-600', iconBg: 'bg-slate-400' };
}

function getActionLabel(action) {
  return ACTION_LABELS[action] || action?.replace(/_/g, ' ') || 'performed action on';
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp + (timestamp.includes('Z') ? '' : 'Z'));
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
}

function formatFullDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp + (timestamp.includes('Z') ? '' : 'Z'));
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Group activities by date
function groupByDate(activities) {
  const groups = {};
  for (const a of activities) {
    const date = new Date(a.timestamp + (a.timestamp.includes('Z') ? '' : 'Z'));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label;
    if (date.toDateString() === today.toDateString()) label = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  }
  return groups;
}

// ── Entities filter list (derived from summary) ───────────────
const ALL_ENTITIES = [
  'task', 'ncr', 'rfi', 'inspection', 'defect', 'document', 'change_order',
  'safety_permit', 'safety_incident', 'submittal', 'material', 'payment',
  'expense', 'ra_bill', 'punch_item', 'auth',
];

export default function ActivityFeedPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [filter, setFilter] = useState({ entity: '', date_from: '', date_to: '' });
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'compact'

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (currentProject?.id) params.set('project_id', currentProject.id);
    if (filter.entity) params.set('entity', filter.entity);
    if (filter.date_from) params.set('date_from', filter.date_from);
    if (filter.date_to) params.set('date_to', filter.date_to);
    params.set('page', page);
    params.set('limit', 30);

    api.get(`/activity-feed?${params}`)
      .then(res => {
        setActivities(res.data || []);
        setPagination(res.pagination);
        setSummary(res.summary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentProject?.id, filter, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const grouped = groupByDate(activities);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentProject ? `Activity for ${currentProject.name}` : 'All project activity'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${viewMode === 'timeline' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Timeline
            </button>
            <button onClick={() => setViewMode('compact')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${viewMode === 'compact' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Compact
            </button>
          </div>
          <button onClick={loadData} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500" title="Refresh">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Activities" value={summary.total} color="blue" />
          <StatCard label="Today" value={summary.todayCount} color="green" />
          <StatCard label="Active Users" value={summary.uniqueUsers} color="purple" />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex gap-1 flex-wrap">
              {summary.entityCounts?.slice(0, 5).map(e => {
                const cfg = getEntityConfig(e.entity);
                return (
                  <span key={e.entity} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}: {e.count}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Top Entities</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filter.entity} onChange={e => { setFilter(f => ({ ...f, entity: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="">All Entities</option>
          {ALL_ENTITIES.map(e => {
            const cfg = getEntityConfig(e);
            return <option key={e} value={e}>{cfg.label}</option>;
          })}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={filter.date_from}
            onChange={e => { setFilter(f => ({ ...f, date_from: e.target.value })); setPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            placeholder="From" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={filter.date_to}
            onChange={e => { setFilter(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            placeholder="To" />
        </div>
        {(filter.entity || filter.date_from || filter.date_to) && (
          <button onClick={() => { setFilter({ entity: '', date_from: '', date_to: '' }); setPage(1); }}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No activity found</p>
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineView groups={grouped} />
      ) : (
        <CompactView activities={activities} />
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} onPageChange={setPage} />
      )}
    </div>
  );
}

// ── Timeline view (grouped by date) ──────────────────────────
function TimelineView({ groups }) {
  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([dateLabel, items]) => (
        <div key={dateLabel}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{dateLabel}</span>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400">{items.length} event{items.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Timeline items */}
          <div className="relative ml-4">
            {/* Vertical line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />

            <div className="space-y-0">
              {items.map((activity, idx) => (
                <TimelineItem key={activity.id} activity={activity} isLast={idx === items.length - 1} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineItem({ activity, isLast }) {
  const cfg = getEntityConfig(activity.entity);
  const actionLabel = getActionLabel(activity.action);
  const isAuth = activity.entity === 'auth';
  const isWorkflow = activity.type === 'workflow';
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex gap-3 pb-4 group">
      {/* Timeline dot */}
      <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white flex-shrink-0 ${cfg.iconBg} ring-2 ring-white`}>
        {cfg.icon}
      </div>

      {/* Content card */}
      <div
        className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Main line */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-800">{activity.user_display || 'System'}</span>
              {' '}
              <span className="text-slate-500">{actionLabel}</span>
              {' '}
              {!isAuth && (
                <>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  {' '}
                  <span className="font-mono text-xs text-slate-500">{activity.entity_id}</span>
                </>
              )}
            </p>

            {/* State transition */}
            {(activity.from_state || activity.to_state) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {activity.from_state && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 line-through">
                    {activity.from_state}
                  </span>
                )}
                {activity.from_state && activity.to_state && (
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
                {activity.to_state && (
                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    isWorkflow ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                  }`}>
                    {activity.to_state}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Time */}
          <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0" title={formatFullDate(activity.timestamp)}>
            {formatTimeAgo(activity.timestamp)}
          </span>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
            {activity.details && (
              <p className="text-xs text-slate-500 break-words">{activity.details}</p>
            )}
            {activity.project_name && (
              <p className="text-[11px] text-slate-400">Project: <span className="text-slate-600">{activity.project_name}</span></p>
            )}
            <p className="text-[10px] text-slate-400">{formatFullDate(activity.timestamp)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compact table view ────────────────────────────────────────
function CompactView({ activities }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Time</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase">User</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Action</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Entity</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Transition</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activities.map(a => {
            const cfg = getEntityConfig(a.entity);
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-[11px] text-slate-400 whitespace-nowrap" title={formatFullDate(a.timestamp)}>
                  {formatTimeAgo(a.timestamp)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700 font-medium">{a.user_display || 'System'}</td>
                <td className="px-4 py-2 text-xs text-slate-500 capitalize">{a.action?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1 font-mono">{a.entity_id}</span>
                </td>
                <td className="px-4 py-2">
                  {(a.from_state || a.to_state) ? (
                    <div className="flex items-center gap-1">
                      {a.from_state && <span className="text-[10px] text-slate-400 line-through">{a.from_state}</span>}
                      {a.from_state && a.to_state && <span className="text-[10px] text-slate-300">&rarr;</span>}
                      {a.to_state && <span className="text-[10px] text-blue-600 font-medium">{a.to_state}</span>}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300">-</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-400 max-w-xs truncate">{a.details || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
