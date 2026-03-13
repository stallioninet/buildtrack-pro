import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import { showError, showWarning, showSuccess } from '../utils/toast';
import CommentsSection from '../components/shared/CommentsSection';
import { MEETING_STATUS_COLORS as STATUS_COLORS } from '../config/constants';

const MEETING_TYPES = [
  { value: 'progress', label: 'Progress Review' },
  { value: 'kickoff', label: 'Kickoff Meeting' },
  { value: 'design', label: 'Design Review' },
  { value: 'safety', label: 'Safety Meeting' },
  { value: 'client', label: 'Client Meeting' },
  { value: 'coordination', label: 'Coordination Meeting' },
  { value: 'handover', label: 'Handover Meeting' },
  { value: 'other', label: 'Other' },
];

const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

export default function MeetingsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '' });
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailView, setDetailView] = useState(null);

  const canCreate = ['pm', 'engineer', 'owner'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    let url = `/meetings?project_id=${pid}`;
    if (filter.status) url += `&status=${filter.status}`;
    Promise.all([
      api.get(url),
      api.get(`/meetings/summary?project_id=${pid}`),
    ]).then(([data, sum]) => {
      setMeetings(data);
      setSummary(sum);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter]);

  const handleStatusChange = async (meeting, newStatus) => {
    try {
      await api.patch(`/meetings/${meeting.id}/status`, { status: newStatus });
      loadData();
    } catch (err) { showError(err.message); }
  };

  const handleDelete = async (meeting) => {
    if (!confirm(`Delete ${meeting.meeting_code}?`)) return;
    try { await api.delete(`/meetings/${meeting.id}`); loadData(); if (detailView?.id === meeting.id) setDetailView(null); } catch (err) { showError(err.message); }
  };

  const openDetail = async (meeting) => {
    try {
      const detail = await api.get(`/meetings/${meeting.id}`);
      setDetailView(detail);
    } catch (err) { showError(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meeting Minutes</h1>
          <p className="text-sm text-slate-500 mt-1">Record meetings, decisions, and track action items</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelected(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Meeting
          </button>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
            <p className="text-xs text-slate-500">Total Meetings</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-blue-600">{summary.upcoming}</p>
            <p className="text-xs text-slate-500">Upcoming</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-600">{summary.actionItems}</p>
            <p className="text-xs text-slate-500">Action Items</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-amber-600">{summary.pendingActions}</p>
            <p className="text-xs text-slate-500">Pending Actions</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Meeting List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No meetings found</div>
          ) : (
            meetings.map(m => (
              <div key={m.id} className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow cursor-pointer ${detailView?.id === m.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}
                onClick={() => openDetail(m)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">{m.meeting_code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600">
                        {MEETING_TYPES.find(t => t.value === m.meeting_type)?.label || m.meeting_type}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] || ''}`}>
                        {m.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">{m.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                      <span>{formatDate(m.meeting_date)}</span>
                      {m.start_time && <span>{m.start_time}{m.end_time ? ` - ${m.end_time}` : ''}</span>}
                      {m.location && <span>{m.location}</span>}
                      {m.organized_by_name && <span>By: {m.organized_by_name}</span>}
                    </div>
                    {m.action_count > 0 && (
                      <div className="mt-1.5">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${m.action_count > 0 ? (m.actions_completed / m.action_count) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{m.actions_completed}/{m.action_count}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <select value={m.status} onChange={e => handleStatusChange(m, e.target.value)}
                      className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-3">
          {detailView ? (
            <MeetingDetail
              meeting={detailView}
              user={user}
              canCreate={canCreate}
              onEdit={() => { setSelected(detailView); setShowModal(true); }}
              onDelete={() => handleDelete(detailView)}
              onRefresh={() => openDetail(detailView)}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
              Click a meeting to view details and action items
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <MeetingModal
          meeting={selected}
          projectId={currentProject.id}
          onClose={() => { setShowModal(false); setSelected(null); }}
          onSaved={() => { setShowModal(false); setSelected(null); loadData(); if (detailView && selected?.id === detailView.id) openDetail(detailView); }}
        />
      )}
    </div>
  );
}

function MeetingDetail({ meeting, user, canCreate, onEdit, onDelete, onRefresh }) {
  const [newAction, setNewAction] = useState({ description: '', assigned_to: '', due_date: '' });
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [addAttendeeId, setAddAttendeeId] = useState('');
  const [convertingAction, setConvertingAction] = useState(null);

  useEffect(() => {
    api.get('/auth/users').then(setUsers).catch(() => {});
  }, []);

  const loadAttendees = async () => {
    setAttendeesLoading(true);
    try {
      const data = await api.get(`/meetings/${meeting.id}/attendees`);
      setAttendees(data);
    } catch { setAttendees([]); }
    finally { setAttendeesLoading(false); }
  };

  useEffect(() => { loadAttendees(); }, [meeting.id]);

  const handleAddAttendee = async () => {
    if (!addAttendeeId) return;
    try {
      await api.post(`/meetings/${meeting.id}/attendees`, { user_id: addAttendeeId });
      setAddAttendeeId('');
      loadAttendees();
    } catch (err) { showError(err.message); }
  };

  const handleRemoveAttendee = async (attendeeId) => {
    try {
      await api.delete(`/meetings/${meeting.id}/attendees/${attendeeId}`);
      loadAttendees();
    } catch (err) { showError(err.message); }
  };

  const handleRsvpChange = async (attendeeId, rsvpStatus) => {
    try {
      await api.patch(`/meetings/${meeting.id}/attendees/${attendeeId}`, { rsvp_status: rsvpStatus });
      loadAttendees();
    } catch (err) { showError(err.message); }
  };

  const handleAttendedToggle = async (attendeeId, attended) => {
    try {
      await api.patch(`/meetings/${meeting.id}/attendees/${attendeeId}`, { attended: attended ? 1 : 0 });
      loadAttendees();
    } catch (err) { showError(err.message); }
  };

  const handleConvertToTask = async (actionId) => {
    setConvertingAction(actionId);
    try {
      await api.post(`/meetings/actions/${actionId}/convert-to-task`);
      showSuccess('Action item converted to task successfully');
      onRefresh();
    } catch (err) { showError(err.message || 'Failed to convert to task'); }
    finally { setConvertingAction(null); }
  };

  const handleAddAction = async () => {
    if (!newAction.description.trim()) return;
    setAdding(true);
    try {
      await api.post(`/meetings/${meeting.id}/actions`, newAction);
      setNewAction({ description: '', assigned_to: '', due_date: '' });
      onRefresh();
    } catch (err) { showError(err.message); } finally { setAdding(false); }
  };

  const toggleAction = async (action) => {
    const newStatus = action.status === 'completed' ? 'open' : 'completed';
    try {
      await api.patch(`/meetings/actions/${action.id}`, { status: newStatus });
      onRefresh();
    } catch (err) { showError(err.message); }
  };

  const deleteAction = async (action) => {
    try { await api.delete(`/meetings/actions/${action.id}`); onRefresh(); } catch (err) { showError(err.message); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{meeting.meeting_code}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[meeting.status] || ''}`}>{meeting.status}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-800 mt-1">{meeting.title}</h3>
        </div>
        {canCreate && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">Edit</button>
            {['owner', 'pm'].includes(user?.role) && (
              <button onClick={onDelete} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">Delete</button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-slate-400">Date:</span> <span className="text-slate-700 font-medium">{formatDate(meeting.meeting_date)}</span></div>
          <div><span className="text-slate-400">Time:</span> <span className="text-slate-700">{meeting.start_time || '-'}{meeting.end_time ? ` to ${meeting.end_time}` : ''}</span></div>
          <div><span className="text-slate-400">Location:</span> <span className="text-slate-700">{meeting.location || '-'}</span></div>
          <div><span className="text-slate-400">Organizer:</span> <span className="text-slate-700">{meeting.organized_by_name || '-'}</span></div>
        </div>

        {/* Attendees Section */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Attendees {attendeesLoading ? '' : `(${attendees.length})`}</p>
          {attendeesLoading ? (
            <p className="text-[11px] text-slate-400">Loading attendees...</p>
          ) : (
            <div className="space-y-1.5">
              {attendees.map(att => (
                <div key={att.id} className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-100 bg-white text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700">{att.user_name || att.name || 'Unknown'}</span>
                    {att.role && <span className="ml-1 text-[10px] text-slate-400">({att.role})</span>}
                  </div>
                  <select value={att.rsvp_status || 'pending'} onChange={e => handleRsvpChange(att.id, e.target.value)}
                    className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white">
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                  </select>
                  <label className="flex items-center gap-1 text-[10px] text-slate-500">
                    <input type="checkbox" checked={!!att.attended}
                      onChange={e => handleAttendedToggle(att.id, e.target.checked)}
                      disabled={!['Completed', 'In Progress'].includes(meeting.status)}
                      className="w-3 h-3 rounded" />
                    Attended
                  </label>
                  {canCreate && (
                    <button onClick={() => handleRemoveAttendee(att.id)}
                      className="text-slate-300 hover:text-red-400 text-xs flex-shrink-0">&times;</button>
                  )}
                </div>
              ))}
              {attendees.length === 0 && <p className="text-[11px] text-slate-400">No attendees added yet.</p>}
            </div>
          )}
          {canCreate && (
            <div className="mt-2 flex gap-2">
              <select value={addAttendeeId} onChange={e => setAddAttendeeId(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5">
                <option value="">Select user...</option>
                {users.filter(u => !attendees.some(a => a.user_id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <button onClick={handleAddAttendee} disabled={!addAttendeeId}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Add</button>
            </div>
          )}
        </div>

        {meeting.agenda && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Agenda</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{meeting.agenda}</p>
          </div>
        )}

        {meeting.minutes && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Minutes</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap bg-blue-50 rounded-lg p-3">{meeting.minutes}</p>
          </div>
        )}

        {meeting.decisions && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Decisions</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap bg-green-50 rounded-lg p-3">{meeting.decisions}</p>
          </div>
        )}

        {/* Action Items */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Action Items ({meeting.action_items?.length || 0})</p>
          <div className="space-y-1.5">
            {(meeting.action_items || []).map(action => (
              <div key={action.id} className={`flex items-start gap-2 p-2 rounded-lg border ${action.status === 'completed' ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'}`}>
                <button onClick={() => toggleAction(action)}
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${action.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                  {action.status === 'completed' && <span className="text-[8px]">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${action.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{action.description}</p>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-slate-400">
                    {action.assigned_to_name && <span>{action.assigned_to_name}</span>}
                    {action.due_date && <span className={new Date(action.due_date) < new Date() && action.status !== 'completed' ? 'text-red-500' : ''}>Due: {formatDate(action.due_date)}</span>}
                  </div>
                </div>
                {action.status !== 'completed' && (
                  <button onClick={() => handleConvertToTask(action.id)} disabled={convertingAction === action.id}
                    title="Convert to Task"
                    className="text-slate-300 hover:text-blue-500 text-xs flex-shrink-0 disabled:opacity-50">
                    {convertingAction === action.id ? '...' : '→'}
                  </button>
                )}
                <button onClick={() => deleteAction(action)} className="text-slate-300 hover:text-red-400 text-xs flex-shrink-0">&times;</button>
              </div>
            ))}
          </div>

          {canCreate && (
            <div className="mt-2 flex gap-2">
              <input type="text" value={newAction.description} onChange={e => setNewAction(a => ({ ...a, description: e.target.value }))}
                placeholder="Add action item..."
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                onKeyDown={e => e.key === 'Enter' && handleAddAction()} />
              <select value={newAction.assigned_to} onChange={e => setNewAction(a => ({ ...a, assigned_to: e.target.value }))}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 w-28">
                <option value="">Assign to</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="date" value={newAction.due_date} onChange={e => setNewAction(a => ({ ...a, due_date: e.target.value }))}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 w-32" />
              <button onClick={handleAddAction} disabled={adding}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Add</button>
            </div>
          )}
        </div>

        <CommentsSection entityType="meeting" entityId={meeting.id} />
      </div>
    </div>
  );
}

function MeetingModal({ meeting, projectId, onClose, onSaved }) {
  const isEdit = !!meeting;
  const [form, setForm] = useState({
    title: meeting?.title || '',
    meeting_type: meeting?.meeting_type || 'progress',
    meeting_date: meeting?.meeting_date || '',
    start_time: meeting?.start_time || '',
    end_time: meeting?.end_time || '',
    location: meeting?.location || '',
    attendees: meeting?.attendees || '',
    agenda: meeting?.agenda || '',
    minutes: meeting?.minutes || '',
    decisions: meeting?.decisions || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim() || !form.meeting_date) return showWarning('Title and date are required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/meetings/${meeting.id}`, form);
      } else {
        await api.post('/meetings', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) { showError(err.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? `Edit ${meeting.meeting_code}` : 'New Meeting'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="e.g., Weekly Progress Review Meeting" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Meeting Type</label>
              <select value={form.meeting_type} onChange={e => set('meeting_type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Date *</label>
              <input type="date" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Start Time</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">End Time</label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Location</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="Site office" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Attendees</label>
            <input type="text" value={form.attendees} onChange={e => set('attendees', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Comma-separated names, e.g., Rajesh Sharma, Ramesh K., Mr. Kumar" />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Agenda</label>
            <textarea value={form.agenda} onChange={e => set('agenda', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Meeting agenda items..." />
          </div>

          {isEdit && (
            <>
              <div>
                <label className="text-xs text-slate-500 font-medium">Minutes</label>
                <textarea value={form.minutes} onChange={e => set('minutes', e.target.value)}
                  rows={4} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Record discussion points, observations, and agreements..." />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Decisions</label>
                <textarea value={form.decisions} onChange={e => set('decisions', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Key decisions taken during the meeting..." />
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
