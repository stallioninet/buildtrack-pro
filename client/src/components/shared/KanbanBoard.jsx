import { useState, useRef, useCallback, useMemo, memo } from 'react';
import { TASK_STATUS_LABELS, TASK_STATUSES, PRIORITY_COLORS } from '../../config/constants';
import { formatDate } from '../../utils/formatters';

const COLUMN_COLORS = {
  not_started: { header: 'bg-slate-500', dot: 'bg-slate-400', border: 'border-slate-200' },
  in_progress: { header: 'bg-blue-500', dot: 'bg-blue-400', border: 'border-blue-200' },
  on_hold: { header: 'bg-yellow-500', dot: 'bg-yellow-400', border: 'border-yellow-200' },
  ready_for_inspection: { header: 'bg-purple-500', dot: 'bg-purple-400', border: 'border-purple-200' },
  rework: { header: 'bg-orange-500', dot: 'bg-orange-400', border: 'border-orange-200' },
  completed: { header: 'bg-green-500', dot: 'bg-green-400', border: 'border-green-200' },
};

const VALID_TRANSITIONS = {
  not_started: ['in_progress'],
  in_progress: ['on_hold', 'ready_for_inspection'],
  on_hold: ['in_progress'],
  ready_for_inspection: ['completed', 'rework'],
  rework: ['in_progress'],
  completed: [],
};

const DEFAULT_WIP_LIMITS = {
  not_started: 0,      // 0 means unlimited
  in_progress: 8,
  on_hold: 5,
  ready_for_inspection: 5,
  rework: 5,
  completed: 0,
};

const SWIMLANE_OPTIONS = [
  { value: 'none', label: 'No Swimlanes' },
  { value: 'priority', label: 'By Priority' },
  { value: 'assignee', label: 'By Assignee' },
  { value: 'stage', label: 'By Stage' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LANE_COLORS = {
  high: { bg: 'bg-red-50/50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-yellow-50/50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
  low: { bg: 'bg-slate-50/50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600' },
};

function KanbanCard({ task, onEdit, onAttach, canEdit, canChangeStatus }) {
  const handleDragStart = (e) => {
    if (!canChangeStatus) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      fromStatus: task.status,
      taskTitle: task.title,
      taskCode: task.task_code,
    }));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-50', 'rotate-1');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-50', 'rotate-1');
  };

  return (
    <div
      draggable={canChangeStatus && task.status !== 'completed'}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all ${
        canChangeStatus && task.status !== 'completed' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-mono text-slate-400">{task.task_code}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>
          {task.priority}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-800 mt-1.5 line-clamp-2">{task.title}</p>
      {task.description && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.description}</p>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.assigned_to_name ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-blue-600">
                  {task.assigned_to_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate max-w-[80px]">{task.assigned_to_name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-300 italic">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task.due_date && (
            <span className={`text-[10px] ${
              new Date(task.due_date) < new Date() && task.status !== 'completed'
                ? 'text-red-500 font-medium'
                : 'text-slate-400'
            }`}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      {task.subtasks?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all"
                style={{ width: `${(task.subtasks.filter(s => s.status === 'completed').length / task.subtasks.length) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">
              {task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length}
            </span>
          </div>
        </div>
      )}
      <div className="mt-2 flex justify-end gap-1">
        {task.attachment_count > 0 && (
          <button onClick={() => onAttach(task)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Attachments">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        )}
        {canEdit && (
          <button onClick={() => onEdit(task)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function StatusNoteModal({ taskTitle, taskCode, fromStatus, toStatus, onConfirm, onCancel }) {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Update Task Status</h3>
          <p className="text-xs text-slate-500 mt-1">
            Moving <strong>{taskCode}</strong> — {taskTitle}
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded font-medium">
              {TASK_STATUS_LABELS[fromStatus]}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              toStatus === 'completed' ? 'bg-green-100 text-green-700' :
              toStatus === 'rework' ? 'bg-orange-100 text-orange-700' :
              toStatus === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {TASK_STATUS_LABELS[toStatus]}
            </span>
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Add a note <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason for status change, any blockers, next steps..."
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>
        <div className="p-5 pt-0 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim() || null)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Move Task
          </button>
        </div>
      </div>
    </div>
  );
}

function WipSettingsModal({ wipLimits, onSave, onCancel }) {
  const [limits, setLimits] = useState({ ...wipLimits });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">WIP Limits</h3>
          <p className="text-xs text-slate-500 mt-1">Set maximum tasks per column. 0 = unlimited.</p>
        </div>
        <div className="p-5 space-y-3">
          {TASK_STATUSES.map(status => (
            <div key={status} className="flex items-center justify-between">
              <label className="text-sm text-slate-700">{TASK_STATUS_LABELS[status]}</label>
              <input
                type="number"
                min="0"
                max="99"
                value={limits[status]}
                onChange={e => setLimits(prev => ({ ...prev, [status]: parseInt(e.target.value) || 0 }))}
                className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <div className="p-5 pt-0 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(limits)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumnHeader({ status, count, wipLimit, isOverWip }) {
  const colors = COLUMN_COLORS[status];

  return (
    <div className={`${colors.header} rounded-t-xl px-3 py-2.5 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <span className="text-white text-xs font-semibold">{TASK_STATUS_LABELS[status]}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isOverWip
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-white/20 text-white'
        }`}>
          {wipLimit > 0 ? `${count}/${wipLimit}` : count}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({ status, tasks, onDrop, onEdit, onAttach, canEdit, canChangeStatus, dragOverStatus, setDragOverStatus, wipLimit, isOverWip }) {
  const colors = COLUMN_COLORS[status];
  const dropRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = (e) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget)) {
      setDragOverStatus(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOverStatus(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.fromStatus !== status) {
        onDrop(data, status);
      }
    } catch (_) {}
  };

  const isOver = dragOverStatus === status;

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-w-[260px] w-[260px] rounded-xl border transition-all ${
        isOverWip ? 'border-red-300 bg-red-50/30' :
        isOver ? `${colors.border} border-2 bg-slate-50/80` : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <KanbanColumnHeader status={status} count={tasks.length} wipLimit={wipLimit} isOverWip={isOverWip} />
      <div className={`flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[100px] ${
        isOver ? 'ring-2 ring-blue-300 ring-inset rounded-b-xl' : ''
      }`}>
        {tasks.length === 0 && (
          <div className="text-center py-8 text-slate-300 text-xs">
            {isOver ? 'Drop here' : 'No tasks'}
          </div>
        )}
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onAttach={onAttach}
            canEdit={canEdit}
            canChangeStatus={canChangeStatus}
          />
        ))}
      </div>
    </div>
  );
}

// Swimlane-aware column: renders only cards matching a swimlane within a status column
function SwimlaneCell({ status, tasks, onDrop, onEdit, onAttach, canEdit, canChangeStatus, dragOverStatus, setDragOverStatus, wipLimit, isOverWip }) {
  const dropRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = (e) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget)) {
      setDragOverStatus(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOverStatus(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.fromStatus !== status) {
        onDrop(data, status);
      }
    } catch (_) {}
  };

  const isOver = dragOverStatus === status;

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-w-[260px] w-[260px] p-2 space-y-2 min-h-[80px] border-r border-slate-100 last:border-r-0 ${
        isOver ? 'bg-blue-50/50' : ''
      }`}
    >
      {tasks.length === 0 && (
        <div className="text-center py-4 text-slate-200 text-[10px]">
          {isOver ? 'Drop here' : '—'}
        </div>
      )}
      {tasks.map(task => (
        <KanbanCard
          key={task.id}
          task={task}
          onEdit={onEdit}
          onAttach={onAttach}
          canEdit={canEdit}
          canChangeStatus={canChangeStatus}
        />
      ))}
    </div>
  );
}

function KanbanBoard({ tasks, onStatusChange, onEdit, onAttach, canEdit, canChangeStatus }) {
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [pendingDrop, setPendingDrop] = useState(null);
  const [wipLimits, setWipLimits] = useState(DEFAULT_WIP_LIMITS);
  const [showWipSettings, setShowWipSettings] = useState(false);
  const [swimlaneBy, setSwimlaneBy] = useState('none');
  const [collapsedLanes, setCollapsedLanes] = useState(new Set());

  // Group tasks by status
  const columns = useMemo(() => {
    const cols = {};
    for (const status of TASK_STATUSES) {
      cols[status] = [];
    }
    for (const task of tasks) {
      if (cols[task.status]) {
        cols[task.status].push(task);
      }
    }
    return cols;
  }, [tasks]);

  // Compute WIP violations
  const wipViolations = useMemo(() => {
    const violations = {};
    for (const status of TASK_STATUSES) {
      const limit = wipLimits[status];
      violations[status] = limit > 0 && columns[status].length > limit;
    }
    return violations;
  }, [columns, wipLimits]);

  // Compute swimlanes
  const swimlanes = useMemo(() => {
    if (swimlaneBy === 'none') return null;

    const laneMap = new Map();

    for (const task of tasks) {
      let key, label;
      if (swimlaneBy === 'priority') {
        key = task.priority || 'low';
        label = (key.charAt(0).toUpperCase() + key.slice(1)) + ' Priority';
      } else if (swimlaneBy === 'assignee') {
        key = task.assigned_to_name || '__unassigned__';
        label = task.assigned_to_name || 'Unassigned';
      } else if (swimlaneBy === 'stage') {
        key = task.stage_name || '__no_stage__';
        label = task.stage_name || 'No Stage';
      }

      if (!laneMap.has(key)) {
        laneMap.set(key, { key, label, tasks: [] });
      }
      laneMap.get(key).tasks.push(task);
    }

    // Sort lanes
    let lanes = [...laneMap.values()];
    if (swimlaneBy === 'priority') {
      lanes.sort((a, b) => (PRIORITY_ORDER[a.key] ?? 99) - (PRIORITY_ORDER[b.key] ?? 99));
    } else {
      // Put "unassigned" / "no stage" at the end
      lanes.sort((a, b) => {
        if (a.key.startsWith('__')) return 1;
        if (b.key.startsWith('__')) return -1;
        return a.label.localeCompare(b.label);
      });
    }

    return lanes;
  }, [tasks, swimlaneBy]);

  const toggleLaneCollapse = useCallback((key) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDrop = useCallback((dragData, toStatus) => {
    const allowed = VALID_TRANSITIONS[dragData.fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      return;
    }
    // Check WIP limit before allowing drop
    const limit = wipLimits[toStatus];
    if (limit > 0 && columns[toStatus].length >= limit) {
      return; // silently reject — column at capacity
    }
    setPendingDrop({ ...dragData, toStatus });
  }, [wipLimits, columns]);

  const handleConfirmDrop = useCallback((note) => {
    if (pendingDrop) {
      onStatusChange(pendingDrop.taskId, pendingDrop.toStatus, note);
      setPendingDrop(null);
    }
  }, [pendingDrop, onStatusChange]);

  const handleCancelDrop = useCallback(() => {
    setPendingDrop(null);
  }, []);

  // Toolbar with swimlane selector and WIP settings
  const toolbar = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        {/* Swimlane selector */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <select
            value={swimlaneBy}
            onChange={e => { setSwimlaneBy(e.target.value); setCollapsedLanes(new Set()); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SWIMLANE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* WIP limit settings button */}
      <button
        onClick={() => setShowWipSettings(true)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors"
        title="Configure WIP limits"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        WIP Limits
      </button>
    </div>
  );

  // Standard view (no swimlanes)
  if (!swimlanes) {
    return (
      <>
        {toolbar}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {TASK_STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columns[status]}
              onDrop={handleDrop}
              onEdit={onEdit}
              onAttach={onAttach}
              canEdit={canEdit}
              canChangeStatus={canChangeStatus}
              dragOverStatus={dragOverStatus}
              setDragOverStatus={setDragOverStatus}
              wipLimit={wipLimits[status]}
              isOverWip={wipViolations[status]}
            />
          ))}
        </div>

        {pendingDrop && (
          <StatusNoteModal
            taskTitle={pendingDrop.taskTitle}
            taskCode={pendingDrop.taskCode}
            fromStatus={pendingDrop.fromStatus}
            toStatus={pendingDrop.toStatus}
            onConfirm={handleConfirmDrop}
            onCancel={handleCancelDrop}
          />
        )}

        {showWipSettings && (
          <WipSettingsModal
            wipLimits={wipLimits}
            onSave={(limits) => { setWipLimits(limits); setShowWipSettings(false); }}
            onCancel={() => setShowWipSettings(false)}
          />
        )}
      </>
    );
  }

  // Swimlane view
  return (
    <>
      {toolbar}
      <div className="overflow-x-auto pb-4">
        {/* Column headers */}
        <div className="flex sticky top-0 z-10">
          <div className="min-w-[180px] w-[180px] flex-shrink-0" /> {/* lane label spacer */}
          {TASK_STATUSES.map(status => {
            const colors = COLUMN_COLORS[status];
            const limit = wipLimits[status];
            const count = columns[status].length;
            const isOver = limit > 0 && count > limit;
            return (
              <div key={status} className="min-w-[260px] w-[260px]">
                <div className={`${colors.header} px-3 py-2.5 flex items-center justify-between ${
                  status === TASK_STATUSES[0] ? 'rounded-tl-xl' : ''
                } ${status === TASK_STATUSES[TASK_STATUSES.length - 1] ? 'rounded-tr-xl' : ''}`}>
                  <span className="text-white text-xs font-semibold">{TASK_STATUS_LABELS[status]}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isOver ? 'bg-red-500 text-white animate-pulse' : 'bg-white/20 text-white'
                  }`}>
                    {limit > 0 ? `${count}/${limit}` : count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Swimlane rows */}
        {swimlanes.map((lane) => {
          const isCollapsed = collapsedLanes.has(lane.key);
          const laneTasksByStatus = {};
          for (const status of TASK_STATUSES) {
            laneTasksByStatus[status] = lane.tasks.filter(t => t.status === status);
          }
          const totalInLane = lane.tasks.length;

          const laneColors = swimlaneBy === 'priority' ? PRIORITY_LANE_COLORS[lane.key] : null;
          const laneBg = laneColors?.bg || 'bg-white';
          const laneBadge = laneColors?.badge || 'bg-slate-100 text-slate-600';

          return (
            <div key={lane.key} className={`border-b border-slate-200 last:border-b-0 ${laneBg}`}>
              {/* Lane header */}
              <div className="flex">
                <div
                  className="min-w-[180px] w-[180px] flex-shrink-0 p-3 flex items-start cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleLaneCollapse(lane.key)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-700 block truncate">{lane.label}</span>
                      <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${laneBadge}`}>
                        {totalInLane} {totalInLane === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cells for each status column */}
                {!isCollapsed && TASK_STATUSES.map(status => (
                  <SwimlaneCell
                    key={status}
                    status={status}
                    tasks={laneTasksByStatus[status]}
                    onDrop={handleDrop}
                    onEdit={onEdit}
                    onAttach={onAttach}
                    canEdit={canEdit}
                    canChangeStatus={canChangeStatus}
                    dragOverStatus={dragOverStatus}
                    setDragOverStatus={setDragOverStatus}
                    wipLimit={wipLimits[status]}
                    isOverWip={wipViolations[status]}
                  />
                ))}

                {/* Collapsed placeholder */}
                {isCollapsed && (
                  <div className="flex-1 flex items-center px-4 py-3">
                    <div className="flex gap-3 flex-wrap">
                      {TASK_STATUSES.map(status => {
                        const count = laneTasksByStatus[status].length;
                        if (count === 0) return null;
                        return (
                          <span key={status} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            COLUMN_COLORS[status].header
                          } text-white`}>
                            {TASK_STATUS_LABELS[status]}: {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingDrop && (
        <StatusNoteModal
          taskTitle={pendingDrop.taskTitle}
          taskCode={pendingDrop.taskCode}
          fromStatus={pendingDrop.fromStatus}
          toStatus={pendingDrop.toStatus}
          onConfirm={handleConfirmDrop}
          onCancel={handleCancelDrop}
        />
      )}

      {showWipSettings && (
        <WipSettingsModal
          wipLimits={wipLimits}
          onSave={(limits) => { setWipLimits(limits); setShowWipSettings(false); }}
          onCancel={() => setShowWipSettings(false)}
        />
      )}
    </>
  );
}

export default memo(KanbanBoard);
