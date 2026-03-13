import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import TaskStatusSelect from '../components/shared/TaskStatusSelect';
import TaskCreateModal from '../components/shared/TaskCreateModal';
import TaskEditModal from '../components/shared/TaskEditModal';
import TaskAttachments from '../components/shared/TaskAttachments';
import KanbanBoard from '../components/shared/KanbanBoard';
import GanttChart from '../components/shared/GanttChart';
import { formatDate } from '../utils/formatters';
import { showError } from '../utils/toast';
import { PRIORITY_COLORS } from '../config/constants';
import { SkeletonTable } from '../components/ui/Skeleton';
import BulkActionBar from '../components/shared/BulkActionBar';

export default function TasksPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState(null); // for adding subtask
  const [editTask, setEditTask] = useState(null);
  const [attachTask, setAttachTask] = useState(null);
  const [attachTab, setAttachTab] = useState(undefined);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [viewMode, setViewMode] = useState('list'); // 'list', 'board', or 'gantt'
  const [filters, setFilters] = useState({ stage_id: '', status: '', priority: '' });
  const [stages, setStages] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [users, setUsers] = useState([]);

  const canCreate = useMemo(() => ['pm', 'engineer'].includes(user?.role), [user?.role]);
  const canEdit = useMemo(() => ['pm', 'engineer', 'owner'].includes(user?.role), [user?.role]);
  const canDelete = useMemo(() => ['pm', 'engineer', 'owner'].includes(user?.role), [user?.role]);
  const canChangeStatus = useMemo(() => ['pm', 'engineer', 'contractor'].includes(user?.role), [user?.role]);
  const isReadOnly = useMemo(() => user?.role === 'owner', [user?.role]);

  const loadTasks = () => {
    const params = new URLSearchParams();
    if (currentProject?.id) params.set('project_id', currentProject.id);
    if (filters.stage_id) params.set('stage_id', filters.stage_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    params.set('page', page);
    params.set('limit', 50);
    const qs = params.toString();
    api.get(`/tasks${qs ? `?${qs}` : ''}`).then(res => {
      if (res && res.data) {
        setTasks(res.data);
        setPagination(res.pagination);
      } else {
        setTasks(Array.isArray(res) ? res : []);
        setPagination(null);
      }
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    const params = currentProject?.id ? `?project_id=${currentProject.id}` : '';
    api.get(`/stages${params}`).then(setStages).catch(console.error);
    if (currentProject?.id) {
      api.get(`/auth/users?project_id=${currentProject.id}`).then(setUsers).catch(console.error);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [filters, currentProject?.id, page]);

  const handleStatusChange = useCallback(async (taskId, newStatus, note) => {
    // Optimistically update the task status in local state
    const updateTaskStatus = (taskList, id, status) =>
      taskList.map(t => {
        if (t.id === id) return { ...t, status };
        if (t.subtasks?.length) return { ...t, subtasks: updateTaskStatus(t.subtasks, id, status) };
        return t;
      });

    setTasks(prev => {
      // Skip if status hasn't changed
      const findTask = (list, id) => {
        for (const t of list) {
          if (t.id === id) return t;
          if (t.subtasks?.length) { const found = findTask(t.subtasks, id); if (found) return found; }
        }
        return null;
      };
      const current = findTask(prev, taskId);
      if (current && current.status === newStatus) return prev;

      const rollback = prev;
      const updated = updateTaskStatus(prev, taskId, newStatus);

      // Fire the API call, revert on failure
      const body = { status: newStatus };
      if (note) body.note = note;
      api.patch(`/tasks/${taskId}/status`, body)
        .then(() => loadTasks()) // reload to get any server-side side effects
        .catch(err => {
          setTasks(rollback);
          showError(err.message || 'Failed to update status');
        });

      return updated;
    });
  }, [filters, currentProject?.id, page]);

  const handleDelete = useCallback(async (taskId, taskTitle) => {
    if (!confirm(`Delete "${taskTitle}" and all its subtasks?`)) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      loadTasks();
    } catch (err) {
      showError(err.message || 'Failed to delete');
    }
  }, [filters, currentProject?.id, page]);

  const toggleExpand = useCallback((taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const handleFilterChange = useCallback((e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setPage(1);
  }, []);

  const toggleSelect = useCallback((taskId) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    }
  }, [tasks, selectedTasks]);

  const handleBulkAction = useCallback(async (action, value) => {
    if (action === 'delete' && !confirm(`Delete ${selectedTasks.size} task(s) and all their subtasks?`)) return;
    try {
      const body = { action, task_ids: [...selectedTasks] };
      if (action === 'status') body.status = value;
      if (action === 'priority') body.priority = value;
      if (action === 'assign') body.assigned_to = parseInt(value);
      await api.post('/tasks/bulk', body);
      setSelectedTasks(new Set());
      loadTasks();
    } catch (err) { showError(err.message || 'Bulk action failed'); }
  }, [selectedTasks]);

  const getSubtaskProgress = useCallback((subtasks) => {
    if (!subtasks || subtasks.length === 0) return null;
    const completed = subtasks.filter(s => s.status === 'completed').length;
    return { completed, total: subtasks.length };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">Manage tasks and subtasks for construction stages</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Kanban board"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'gantt' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Gantt chart"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h7v4H3zM7 10h9v4H7zM5 16h6v4H5z" />
              </svg>
            </button>
          </div>
          {canCreate && (
            <button
              onClick={() => { setCreateParent(null); setShowCreate(true); }}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>+</span> New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {viewMode === 'list' && tasks.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={tasks.length > 0 && selectedTasks.size === tasks.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Select all
            </label>
          )}
          <select name="stage_id" value={filters.stage_id} onChange={handleFilterChange}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="ready_for_inspection">Ready for Inspection</option>
            <option value="rework">Rework</option>
            <option value="completed">Completed</option>
          </select>
          <select name="priority" value={filters.priority} onChange={handleFilterChange}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task list / Kanban board */}
      {loading ? (
        viewMode === 'board' ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="min-w-[260px] w-[260px] rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="bg-slate-300 animate-pulse rounded-t-xl h-9" />
                <div className="p-2 space-y-2">
                  {[1,2].map(j => <div key={j} className="bg-white rounded-lg h-24 animate-pulse" />)}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'gantt' ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="h-10 bg-slate-50 border-b border-slate-200 animate-pulse" />
            <div className="flex">
              <div className="w-[280px] border-r border-slate-200 space-y-1 p-3">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
              </div>
              <div className="flex-1 p-3 space-y-1">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-8 flex items-center">
                    <div className="bg-blue-100 rounded h-5 animate-pulse" style={{ width: `${30 + Math.random() * 50}%`, marginLeft: `${Math.random() * 20}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : <SkeletonTable rows={8} />
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No tasks found
        </div>
      ) : viewMode === 'board' ? (
        <KanbanBoard
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onEdit={(task) => setEditTask(task)}
          onAttach={(task) => { setAttachTab(undefined); setAttachTask(task); }}
          canEdit={canEdit}
          canChangeStatus={canChangeStatus && !isReadOnly}
        />
      ) : viewMode === 'gantt' ? (
        <GanttChart
          tasks={tasks}
          stages={stages}
          onEdit={(task) => setEditTask(task)}
          onStatusChange={handleStatusChange}
          canEdit={canEdit}
          canChangeStatus={canChangeStatus && !isReadOnly}
        />
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
          {tasks.map((task) => {
            const progress = getSubtaskProgress(task.subtasks);
            const isExpanded = expandedTasks[task.id];

            return (
              <div key={task.id} className={`bg-white rounded-xl border overflow-hidden ${selectedTasks.has(task.id) ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}`}>
                {/* Parent task row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Bulk select checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      />
                      {/* Expand toggle */}
                      {task.subtasks?.length > 0 ? (
                        <button onClick={() => toggleExpand(task.id)}
                          className="mt-0.5 text-slate-400 hover:text-slate-600 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="w-5 flex-shrink-0" />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-400">{task.task_code}</span>
                          <span className="text-sm font-medium text-slate-800">{task.title}</span>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>
                            {task.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>{task.stage_name}</span>
                          {task.assigned_to_name && <span>Assigned: {task.assigned_to_name}</span>}
                          {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                          {progress && (
                            <span className="text-blue-600 font-medium">
                              {progress.completed}/{progress.total} subtasks done
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate max-w-lg">{task.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <TaskStatusSelect
                        value={task.status}
                        onChange={(s) => handleStatusChange(task.id, s)}
                        disabled={isReadOnly || !canChangeStatus}
                      />
                      <button
                        onClick={() => { setAttachTab(undefined); setAttachTask(task); }}
                        title="Documents & attachments"
                        className={`p-1.5 rounded relative ${task.attachment_count > 0 ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {task.attachment_count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                            {task.attachment_count}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => { setAttachTab('photos'); setAttachTask(task); }}
                        title="Photos"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      {canCreate && (
                        <button
                          onClick={() => { setCreateParent(task); setShowCreate(true); }}
                          title="Add subtask"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => setEditTask(task)}
                          title="Edit task"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(task.id, task.title)}
                          title="Delete task"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subtask progress bar */}
                  {progress && progress.total > 0 && (
                    <div className="mt-2 ml-8">
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Subtasks (expanded) */}
                {isExpanded && task.subtasks?.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {task.subtasks.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0 ml-8">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                          <span className="text-xs font-mono text-slate-400">{sub.task_code}</span>
                          <span className="text-sm text-slate-700">{sub.title}</span>
                          {sub.assigned_to_name && (
                            <span className="text-xs text-slate-400">({sub.assigned_to_name})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sub.due_date && (
                            <span className="text-xs text-slate-400">{formatDate(sub.due_date)}</span>
                          )}
                          <TaskStatusSelect
                            value={sub.status}
                            onChange={(s) => handleStatusChange(sub.id, s)}
                            disabled={isReadOnly || !canChangeStatus}
                          />
                          <button onClick={() => { setAttachTab(undefined); setAttachTask(sub); }} title="Documents"
                            className={`p-1 rounded relative ${sub.attachment_count > 0 ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {sub.attachment_count > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                                {sub.attachment_count}
                              </span>
                            )}
                          </button>
                          <button onClick={() => { setAttachTab('photos'); setAttachTask(sub); }} title="Photos"
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          {canEdit && (
                            <button onClick={() => setEditTask(sub)} title="Edit"
                              className="p-1 text-slate-400 hover:text-amber-600 rounded">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(sub.id, sub.title)} title="Delete"
                              className="p-1 text-slate-400 hover:text-red-600 rounded">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
        </div>
      )}

      {showCreate && (
        <TaskCreateModal
          defaultStageId={createParent?.stage_id}
          parentTask={createParent}
          onClose={() => { setShowCreate(false); setCreateParent(null); }}
          onCreated={() => loadTasks()}
        />
      )}

      {editTask && (
        <TaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onUpdated={() => { setEditTask(null); loadTasks(); }}
        />
      )}

      {attachTask && (
        <TaskAttachments
          taskId={attachTask.id}
          taskTitle={attachTask.title}
          initialTab={attachTab}
          onClose={() => { setAttachTask(null); setAttachTab(undefined); loadTasks(); }}
        />
      )}

      {selectedTasks.size > 0 && (
        <BulkActionBar
          selectedCount={selectedTasks.size}
          entityType="task"
          onAction={handleBulkAction}
          onClear={() => setSelectedTasks(new Set())}
          users={users}
        />
      )}
    </div>
  );
}
