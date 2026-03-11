import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import TaskStatusSelect from '../components/shared/TaskStatusSelect';
import TaskCreateModal from '../components/shared/TaskCreateModal';
import TaskEditModal from '../components/shared/TaskEditModal';
import TaskAttachments from '../components/shared/TaskAttachments';
import { formatDate } from '../utils/formatters';

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-600',
};

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
  const [filters, setFilters] = useState({ stage_id: '', status: '', priority: '' });
  const [stages, setStages] = useState([]);

  const canCreate = ['pm', 'engineer'].includes(user?.role);
  const canEdit = ['pm', 'engineer', 'owner'].includes(user?.role);
  const canDelete = ['pm', 'engineer', 'owner'].includes(user?.role);
  const canChangeStatus = ['pm', 'engineer', 'contractor'].includes(user?.role);
  const isReadOnly = user?.role === 'owner';

  const loadTasks = () => {
    const params = new URLSearchParams();
    if (currentProject?.id) params.set('project_id', currentProject.id);
    if (filters.stage_id) params.set('stage_id', filters.stage_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    const qs = params.toString();
    api.get(`/tasks${qs ? `?${qs}` : ''}`).then(setTasks).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    const params = currentProject?.id ? `?project_id=${currentProject.id}` : '';
    api.get(`/stages${params}`).then(setStages).catch(console.error);
  }, [currentProject?.id]);

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [filters, currentProject?.id]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (taskId, taskTitle) => {
    if (!confirm(`Delete "${taskTitle}" and all its subtasks?`)) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const getSubtaskProgress = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return null;
    const completed = subtasks.filter(s => s.status === 'completed').length;
    return { completed, total: subtasks.length };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">Manage tasks and subtasks for construction stages</p>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
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

      {/* Task list */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No tasks found
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const progress = getSubtaskProgress(task.subtasks);
            const isExpanded = expandedTasks[task.id];

            return (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Parent task row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
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
    </div>
  );
}
