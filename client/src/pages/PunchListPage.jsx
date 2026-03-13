import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import { showError } from '../utils/toast';
import CommentsSection from '../components/shared/CommentsSection';
import Pagination from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';
import BulkActionBar from '../components/shared/BulkActionBar';
import {
  PUNCH_STATUS_COLORS, PUNCH_STATUS_LABELS, PUNCH_STATUSES,
  PUNCH_CATEGORIES, PUNCH_PRIORITIES, RISK_COLORS,
} from '../config/constants';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export default function PunchListPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '', category: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());

  const canCreate = ['pm', 'engineer', 'inspector'].includes(user?.role);
  const canChangeStatus = ['pm', 'engineer', 'inspector', 'contractor'].includes(user?.role);
  const canEdit = ['pm', 'engineer', 'inspector'].includes(user?.role);
  const isReadOnly = user?.role === 'owner' || user?.role === 'accounts';

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    const qs = `project_id=${pid}${filter.status ? `&status=${filter.status}` : ''}${filter.priority ? `&priority=${filter.priority}` : ''}${filter.category ? `&category=${filter.category}` : ''}&page=${page}&limit=50`;
    Promise.all([
      api.get(`/punch-lists?${qs}`),
      api.get(`/punch-lists/summary?project_id=${pid}`),
    ]).then(([listData, summaryData]) => {
      if (listData?.data) {
        setItems(listData.data);
        setPagination(listData.pagination);
      }
      setSummary(summaryData);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter, page]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
    api.get('/auth/users').then(setUsers).catch(() => setUsers([]));
  }, [currentProject?.id]);

  const handleStatusChange = async (item, newStatus) => {
    try {
      await api.patch(`/punch-lists/${item.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete ${item.punch_code}?`)) return;
    try {
      await api.delete(`/punch-lists/${item.id}`);
      if (selectedItem?.id === item.id) setSelectedItem(null);
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to delete');
    }
  };

  const toggleSelect = useCallback((id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  }, [items, selectedItems]);

  const handleBulkAction = useCallback(async (action, value) => {
    if (action === 'delete' && !confirm(`Delete ${selectedItems.size} punch item(s)?`)) return;
    try {
      const body = { action, item_ids: [...selectedItems] };
      if (action === 'status') body.status = value;
      if (action === 'priority') body.priority = value;
      if (action === 'assign') body.assigned_to = parseInt(value);
      await api.post('/punch-lists/bulk', body);
      setSelectedItems(new Set());
      loadData();
    } catch (err) { showError(err.message || 'Bulk action failed'); }
  }, [selectedItems]);

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Select a project to view punch list items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Punch Lists</h1>
          <p className="text-sm text-slate-500 mt-1">Track deficiency items for pre-handover completion</p>
        </div>
        {canCreate && (
          <button onClick={() => { setShowModal(true); setSelectedItem(null); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Punch Item
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryCard label="Total" value={summary.total} color="bg-slate-100 text-slate-700" />
          {summary.byStatus?.map(s => (
            <SummaryCard key={s.status} label={PUNCH_STATUS_LABELS[s.status] || s.status} value={s.count}
              color={PUNCH_STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600'} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">
          <option value="">All Statuses</option>
          {PUNCH_STATUSES.map(s => <option key={s} value={s}>{PUNCH_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filter.priority} onChange={e => { setFilter(f => ({ ...f, priority: e.target.value })); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">
          <option value="">All Priorities</option>
          {PUNCH_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={filter.category} onChange={e => { setFilter(f => ({ ...f, category: e.target.value })); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">
          <option value="">All Categories</option>
          {PUNCH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filter.status || filter.priority || filter.category) && (
          <button onClick={() => { setFilter({ status: '', priority: '', category: '' }); setPage(1); }}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">Clear filters</button>
        )}
      </div>

      {/* Table */}
      {loading ? <SkeletonTable rows={6} cols={7} /> : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">No punch items found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={items.length > 0 && selectedItems.size === items.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Assigned To</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => (
                  <tr key={item.id} className={`hover:bg-slate-50 cursor-pointer ${selectedItems.has(item.id) ? 'bg-blue-50/50' : ''}`} onClick={() => setSelectedItem(item)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{item.punch_code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[250px] truncate">{item.title}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">{item.location || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.category}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${RISK_COLORS[item.priority] || 'bg-slate-100 text-slate-600'}`}>
                        {PRIORITY_LABELS[item.priority] || item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canChangeStatus && !isReadOnly && item.status !== 'closed' && item.status !== 'void' ? (
                        <select value={item.status}
                          onChange={e => { e.stopPropagation(); handleStatusChange(item, e.target.value); }}
                          onClick={e => e.stopPropagation()}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${PUNCH_STATUS_COLORS[item.status] || ''}`}>
                          {PUNCH_STATUSES.filter(s => s !== 'void').map(s => (
                            <option key={s} value={s}>{PUNCH_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PUNCH_STATUS_COLORS[item.status] || ''}`}>
                          {PUNCH_STATUS_LABELS[item.status] || item.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.assigned_to_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{item.due_date ? formatDate(item.due_date) : '—'}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && item.status !== 'closed' && (
                          <button onClick={() => { setSelectedItem(item); setShowModal(true); }}
                            className="p-1 text-slate-400 hover:text-blue-600" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {user?.role === 'pm' && (
                          <button onClick={() => handleDelete(item)}
                            className="p-1 text-slate-400 hover:text-red-600" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200">
              <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selectedItem && !showModal && (
        <PunchDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange} canChangeStatus={canChangeStatus && !isReadOnly}
          canEdit={canEdit} onEdit={() => setShowModal(true)} />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <PunchModal item={selectedItem} stages={stages} users={users}
          projectId={currentProject.id}
          onClose={() => { setShowModal(false); }}
          onSaved={() => { setShowModal(false); loadData(); }} />
      )}

      {selectedItems.size > 0 && (
        <BulkActionBar
          selectedCount={selectedItems.size}
          entityType="punch_list"
          onAction={handleBulkAction}
          onClear={() => setSelectedItems(new Set())}
          users={users}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function PunchDetailPanel({ item, onClose, onStatusChange, canChangeStatus, canEdit, onEdit }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-blue-600 font-medium">{item.punch_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PUNCH_STATUS_COLORS[item.status] || ''}`}>
              {PUNCH_STATUS_LABELS[item.status] || item.status}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${RISK_COLORS[item.priority] || ''}`}>
              {PRIORITY_LABELS[item.priority]}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{item.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && item.status !== 'closed' && (
            <button onClick={onEdit}
              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Edit</button>
          )}
          <button onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {item.description && <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-slate-400 block text-xs">Location</span><span className="text-slate-700">{item.location || '—'}</span></div>
        <div><span className="text-slate-400 block text-xs">Category</span><span className="text-slate-700">{item.category}</span></div>
        <div><span className="text-slate-400 block text-xs">Stage</span><span className="text-slate-700">{item.stage_name || '—'}</span></div>
        <div><span className="text-slate-400 block text-xs">Assigned To</span><span className="text-slate-700">{item.assigned_to_name || 'Unassigned'}</span></div>
        <div><span className="text-slate-400 block text-xs">Created By</span><span className="text-slate-700">{item.created_by_name}</span></div>
        <div><span className="text-slate-400 block text-xs">Due Date</span><span className="text-slate-700">{item.due_date ? formatDate(item.due_date) : '—'}</span></div>
        <div><span className="text-slate-400 block text-xs">Created</span><span className="text-slate-700">{formatDate(item.created_at)}</span></div>
        {item.closed_by_name && (
          <div><span className="text-slate-400 block text-xs">Closed By</span><span className="text-slate-700">{item.closed_by_name} on {formatDate(item.closed_at)}</span></div>
        )}
      </div>

      {canChangeStatus && item.status !== 'closed' && item.status !== 'void' && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">Change status:</span>
          {PUNCH_STATUSES.filter(s => s !== item.status && s !== 'void').map(s => (
            <button key={s} onClick={() => onStatusChange(item, s)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${PUNCH_STATUS_COLORS[s]}`}>
              {PUNCH_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100">
        <CommentsSection entityType="punch_item" entityId={item.id} />
      </div>
    </div>
  );
}

function PunchModal({ item, stages, users, projectId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    location: item?.location || '',
    category: item?.category || 'General',
    priority: item?.priority || 'medium',
    stage_id: item?.stage_id || '',
    assigned_to: item?.assigned_to || '',
    due_date: item?.due_date || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return showError('Title is required');
    setSaving(true);
    try {
      if (item?.id) {
        await api.patch(`/punch-lists/${item.id}`, form);
      } else {
        await api.post('/punch-lists', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{item?.id ? 'Edit Punch Item' : 'New Punch Item'}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Brief description of the deficiency" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Detailed description..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g., 2nd Floor, Room 3, East Wall" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                {PUNCH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                {PUNCH_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select value={form.stage_id} onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">— None —</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : item?.id ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
