import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import TaskStatusSelect from '../components/shared/TaskStatusSelect';
import TaskCreateModal from '../components/shared/TaskCreateModal';
import TaskEditModal from '../components/shared/TaskEditModal';
import TaskAttachments from '../components/shared/TaskAttachments';
import { formatCurrency, formatDate } from '../utils/formatters';

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-600',
};

const GATE_INDICATORS = {
  blocked: { icon: '!', color: 'bg-red-500 text-white', title: 'Blocked: linked inspection failed' },
  pending: { icon: '?', color: 'bg-amber-400 text-white', title: 'Pending: required inspection not yet completed' },
  clear: { icon: '\u2713', color: 'bg-green-500 text-white', title: 'All required inspections passed' },
};

const LINK_TYPE_COLORS = {
  required: 'bg-red-100 text-red-700',
  related: 'bg-blue-100 text-blue-700',
  blocked_by: 'bg-orange-100 text-orange-700',
};

export default function StageDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [stage, setStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [attachTask, setAttachTask] = useState(null);
  const [attachTab, setAttachTab] = useState(undefined); // 'photos' or undefined
  const [expandedTasks, setExpandedTasks] = useState({});
  const [linkInspTask, setLinkInspTask] = useState(null); // task to link inspections to
  const [taskInspections, setTaskInspections] = useState({}); // { taskId: [inspections] }

  const canCreate = ['pm', 'engineer'].includes(user?.role);
  const canEdit = ['pm', 'engineer', 'owner'].includes(user?.role);
  const canDelete = ['pm', 'engineer', 'owner'].includes(user?.role);
  const canChangeStatus = ['pm', 'engineer', 'contractor'].includes(user?.role);
  const isReadOnly = user?.role === 'owner';

  const reload = () => api.get(`/stages/${id}`).then(setStage).catch(console.error);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [id]);

  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      reload();
    } catch (err) {
      // Show gating error with blocker details
      const msg = err.message || 'Failed to update task status';
      alert(msg);
    }
  };

  const loadTaskInspections = async (taskId) => {
    if (taskInspections[taskId]) return; // already loaded
    try {
      const insps = await api.get(`/tasks/${taskId}/inspections`);
      setTaskInspections(prev => ({ ...prev, [taskId]: insps }));
    } catch { /* ignore */ }
  };

  const handleUnlinkInspection = async (taskId, linkId) => {
    if (!confirm('Remove this inspection link?')) return;
    try {
      await api.delete(`/tasks/${taskId}/inspections/${linkId}`);
      setTaskInspections(prev => ({ ...prev, [taskId]: prev[taskId]?.filter(i => i.link_id !== linkId) }));
      reload();
    } catch (err) {
      alert(err.message || 'Failed to unlink');
    }
  };

  const handleDeleteTask = async (taskId, title) => {
    if (!confirm(`Delete "${title}" and all its subtasks?`)) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      reload();
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const toggleExpand = (taskId) => {
    const willExpand = !expandedTasks[taskId];
    setExpandedTasks(prev => ({ ...prev, [taskId]: willExpand }));
    if (willExpand) loadTaskInspections(taskId);
  };

  const toggleChecklist = async (itemId, checked) => {
    try {
      await api.patch(`/stages/checklist/${itemId}`, { is_checked: !checked });
      reload();
    } catch (err) {
      console.error('Failed to toggle checklist:', err);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading stage details...</div>;
  if (!stage) return <div className="text-center py-12 text-red-500">Stage not found</div>;

  const totalTasks = stage.tasks?.length || 0;
  const totalSubtasks = stage.tasks?.reduce((s, t) => s + (t.subtasks?.length || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link to="/projects" className="hover:text-blue-600">Projects</Link>
        <span>/</span>
        <Link to="/stages" className="hover:text-blue-600">{currentProject?.name || 'Stages'}</Link>
        <span>/</span>
        <span className="text-slate-700">{stage.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{stage.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Budget: {formatCurrency(stage.budget)} | Spent: {formatCurrency(stage.spent)}</p>
        </div>
        <Badge status={stage.status} />
      </div>

      <ProgressBar value={stage.completion} />

      {/* SP62 Chapters */}
      {stage.sp62Chapters?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">SP 62:1997 References</h3>
          <div className="space-y-2">
            {stage.sp62Chapters.map((ch) => (
              <div key={ch.id} className="flex items-start gap-2">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">Ch. {ch.chapter_number}</span>
                <div>
                  <p className="text-sm text-amber-900">{ch.title}</p>
                  {ch.note && <p className="text-xs text-amber-600 mt-0.5">{ch.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks for this stage */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Tasks ({totalTasks})</h3>
            {totalSubtasks > 0 && (
              <p className="text-xs text-slate-500">{totalSubtasks} subtasks across all tasks</p>
            )}
          </div>
          {canCreate && (
            <button
              onClick={() => { setCreateParent(null); setShowCreate(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              + Add Task
            </button>
          )}
        </div>

        {stage.tasks?.length > 0 ? (
          <div className="space-y-2">
            {stage.tasks.map((task) => {
              const isExpanded = expandedTasks[task.id];
              const subtaskCount = task.subtasks?.length || 0;
              const completedSubs = task.subtasks?.filter(s => s.status === 'completed').length || 0;

              return (
                <div key={task.id} className="border border-slate-100 rounded-lg overflow-hidden">
                  {/* Parent task */}
                  <div className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {subtaskCount > 0 ? (
                        <button onClick={() => toggleExpand(task.id)}
                          className="text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="w-5 flex-shrink-0" />
                      )}
                      <span className="text-xs font-mono text-slate-400">{task.task_code}</span>
                      <span className="text-sm text-slate-700 truncate">{task.title}</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>
                        {task.priority}
                      </span>
                      {subtaskCount > 0 && (
                        <span className="text-xs text-blue-600 font-medium">{completedSubs}/{subtaskCount}</span>
                      )}
                      {task.inspection_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-[10px] text-indigo-600 font-medium">{task.inspection_count}</span>
                          {task.inspection_gate && GATE_INDICATORS[task.inspection_gate] && (
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${GATE_INDICATORS[task.inspection_gate].color}`}
                              title={GATE_INDICATORS[task.inspection_gate].title}>
                              {GATE_INDICATORS[task.inspection_gate].icon}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.assigned_to_name && <span className="text-xs text-slate-500">{task.assigned_to_name}</span>}
                      {task.due_date && <span className="text-xs text-slate-400">{formatDate(task.due_date)}</span>}
                      <TaskStatusSelect
                        value={task.status}
                        onChange={(s) => handleTaskStatusChange(task.id, s)}
                        disabled={isReadOnly || !canChangeStatus}
                      />
                      <button onClick={() => { setAttachTab(undefined); setAttachTask(task); }} title="Documents"
                        className={`p-1 rounded relative ${task.attachment_count > 0 ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {task.attachment_count > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                            {task.attachment_count}
                          </span>
                        )}
                      </button>
                      <button onClick={() => { setAttachTab('photos'); setAttachTask(task); }} title="Photos"
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      {canCreate && (
                        <button onClick={() => setLinkInspTask(task)}
                          title="Link Inspection" className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </button>
                      )}
                      {canCreate && (
                        <button onClick={() => { setCreateParent(task); setShowCreate(true); }}
                          title="Add subtask" className="p-1 text-slate-400 hover:text-blue-600 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setEditTask(task)} title="Edit"
                          className="p-1 text-slate-400 hover:text-amber-600 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDeleteTask(task.id, task.title)} title="Delete"
                          className="p-1 text-slate-400 hover:text-red-600 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subtasks */}
                  {isExpanded && task.subtasks?.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      {task.subtasks.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between px-3 py-2 border-b border-slate-100 last:border-0 ml-7">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                            <span className="text-xs font-mono text-slate-400">{sub.task_code}</span>
                            <span className="text-sm text-slate-600">{sub.title}</span>
                            {sub.assigned_to_name && <span className="text-xs text-slate-400">({sub.assigned_to_name})</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <TaskStatusSelect
                              value={sub.status}
                              onChange={(s) => handleTaskStatusChange(sub.id, s)}
                              disabled={isReadOnly || !canChangeStatus}
                            />
                            <button onClick={() => { setAttachTab(undefined); setAttachTask(sub); }} title="Documents"
                              className={`p-1 rounded relative ${sub.attachment_count > 0 ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            {canEdit && (
                              <button onClick={() => setEditTask(sub)} className="p-1 text-slate-400 hover:text-amber-600 rounded">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDeleteTask(sub.id, sub.title)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Linked Inspections */}
                  {isExpanded && taskInspections[task.id]?.length > 0 && (
                    <div className="border-t border-indigo-100 bg-indigo-50/30 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold mb-1.5">Linked Inspections</p>
                      {taskInspections[task.id].map(insp => (
                        <div key={insp.link_id} className="flex items-center justify-between py-1.5 border-b border-indigo-100/50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${LINK_TYPE_COLORS[insp.link_type] || 'bg-slate-100 text-slate-600'}`}>
                              {insp.link_type}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{insp.inspection_code}</span>
                            <span className="text-xs text-slate-600">{insp.type}</span>
                            {insp.category && (
                              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                                insp.category === 'hold_point' ? 'bg-red-50 text-red-600' :
                                insp.category === 'witness_point' ? 'bg-amber-50 text-amber-600' :
                                'bg-slate-50 text-slate-500'
                              }`}>{insp.category === 'hold_point' ? 'HP' : insp.category === 'witness_point' ? 'WP' : 'SV'}</span>
                            )}
                            <span className="text-xs text-slate-400">{formatDate(insp.inspection_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {insp.result && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                insp.result === 'Pass' ? 'bg-green-100 text-green-700' :
                                insp.result === 'Fail' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{insp.result}</span>
                            )}
                            <Badge status={insp.status} />
                            {insp.defect_count > 0 && (
                              <span className="text-[10px] text-red-600 font-medium">{insp.defect_count}D</span>
                            )}
                            {canEdit && (
                              <button onClick={() => handleUnlinkInspection(task.id, insp.link_id)}
                                title="Unlink" className="p-0.5 text-slate-400 hover:text-red-500">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
        ) : (
          <p className="text-sm text-slate-400">No tasks for this stage yet</p>
        )}
      </div>

      {showCreate && (
        <TaskCreateModal
          defaultStageId={stage.id}
          parentTask={createParent}
          onClose={() => { setShowCreate(false); setCreateParent(null); }}
          onCreated={() => reload()}
        />
      )}

      {editTask && (
        <TaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onUpdated={() => { setEditTask(null); reload(); }}
        />
      )}

      {attachTask && (
        <TaskAttachments
          taskId={attachTask.id}
          taskTitle={attachTask.title}
          initialTab={attachTab}
          onClose={() => { setAttachTask(null); setAttachTab(undefined); reload(); }}
        />
      )}

      {/* Link Inspection Modal */}
      {linkInspTask && (
        <LinkInspectionModal
          task={linkInspTask}
          projectId={currentProject?.id}
          existingLinks={taskInspections[linkInspTask.id] || []}
          onClose={() => setLinkInspTask(null)}
          onLinked={() => {
            setTaskInspections(prev => ({ ...prev, [linkInspTask.id]: undefined }));
            loadTaskInspections(linkInspTask.id);
            setLinkInspTask(null);
            reload();
          }}
        />
      )}

      {/* Substages and checklists */}
      <div className="space-y-4">
        {stage.substages?.map((sub) => (
          <div key={sub.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {sub.substage_order}. {sub.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{sub.completion}%</span>
                <Badge status={sub.status} />
              </div>
            </div>
            <ProgressBar value={sub.completion} className="mb-3" />

            {sub.checklistItems?.length > 0 && (
              <div className="space-y-1">
                {sub.checklistItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={!!item.is_checked}
                      onChange={() => toggleChecklist(item.id, item.is_checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className={`text-sm ${item.is_checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {item.description}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.standard_ref && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{item.standard_ref}</span>
                        )}
                        {item.is_mandatory === 1 && (
                          <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Mandatory</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== LINK INSPECTION MODAL ====================

function LinkInspectionModal({ task, projectId, existingLinks, onClose, onLinked }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkType, setLinkType] = useState('related');
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!projectId) return;
    api.get(`/inspections?project_id=${projectId}`)
      .then(setInspections)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const linkedIds = new Set((existingLinks || []).map(l => l.inspection_id));

  const available = inspections.filter(i => {
    if (linkedIds.has(i.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (i.inspection_code || '').toLowerCase().includes(q) ||
      (i.type || '').toLowerCase().includes(q) ||
      (i.stage_name || '').toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q)
    );
  });

  const handleLink = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post(`/tasks/${task.id}/inspections`, {
        inspection_id: selected,
        link_type: linkType,
      });
      onLinked();
    } catch (err) {
      alert(err.message || 'Failed to link inspection');
    } finally {
      setSubmitting(false);
    }
  };

  const RESULT_COLORS = {
    Pass: 'bg-green-100 text-green-700',
    Fail: 'bg-red-100 text-red-700',
    Conditional: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-slate-800">Link Inspection</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
          </div>
          <p className="text-xs text-slate-500">
            Link an inspection to <span className="font-medium text-slate-700">{task.task_code} — {task.title}</span>
          </p>
        </div>

        {/* Link type selector */}
        <div className="px-4 pt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Link type:</span>
          {['related', 'required', 'blocked_by'].map(lt => (
            <button key={lt} onClick={() => setLinkType(lt)}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                linkType === lt
                  ? (lt === 'required' ? 'bg-red-100 text-red-700' : lt === 'blocked_by' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {lt === 'blocked_by' ? 'blocked by' : lt}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, type, stage, location..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
        </div>

        {/* Inspection list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 min-h-0">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading inspections...</div>
          ) : available.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {inspections.length === 0 ? 'No inspections for this project' : 'No unlinked inspections match your search'}
            </div>
          ) : (
            available.map(insp => (
              <button key={insp.id} onClick={() => setSelected(insp.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected === insp.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500">{insp.inspection_code}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{insp.type}</span>
                  {insp.category && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      insp.category === 'hold_point' ? 'bg-red-50 text-red-700' :
                      insp.category === 'witness_point' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-50 text-slate-600'
                    }`}>{
                      insp.category === 'hold_point' ? 'Hold Point' :
                      insp.category === 'witness_point' ? 'Witness Point' :
                      'Surveillance'
                    }</span>
                  )}
                  {insp.result && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_COLORS[insp.result] || ''}`}>
                      {insp.result}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    insp.status === 'Completed' ? 'bg-green-50 text-green-600' :
                    insp.status === 'In Progress' ? 'bg-amber-50 text-amber-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>{insp.status}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  {insp.stage_name && <span>{insp.stage_name}</span>}
                  {insp.inspection_date && <span>{formatDate(insp.inspection_date)}</span>}
                  {insp.location && <span>@ {insp.location}</span>}
                  {insp.defect_count > 0 && <span className="text-red-500">{insp.defect_count} defects</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-400">{available.length} available</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleLink} disabled={!selected || submitting}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Linking...' : 'Link Inspection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
