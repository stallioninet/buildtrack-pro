import { useState } from 'react';

export default function BulkActionBar({ selectedCount, onAction, onClear, entityType = 'items', users = [] }) {
  const [actionType, setActionType] = useState('');
  const [actionValue, setActionValue] = useState('');

  if (selectedCount === 0) return null;

  const handleApply = () => {
    if (!actionType) return;
    onAction(actionType, actionValue);
    setActionType('');
    setActionValue('');
  };

  const isTask = entityType === 'tasks' || entityType === 'task';
  const statusOptions = isTask
    ? ['not_started', 'in_progress', 'on_hold', 'ready_for_inspection', 'rework', 'completed']
    : ['open', 'in_progress', 'ready_for_review', 'closed', 'void'];

  const priorityOptions = entityType === 'tasks'
    ? ['low', 'medium', 'high', 'critical']
    : ['low', 'medium', 'high', 'critical'];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 text-white px-6 py-3 flex items-center justify-between z-40 shadow-lg">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          {selectedCount} {entityType} selected
        </span>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-white underline">
          Clear selection
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={actionType}
          onChange={(e) => { setActionType(e.target.value); setActionValue(''); }}
          className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">Select action...</option>
          <option value="status">Change Status</option>
          <option value="priority">Change Priority</option>
          {users.length > 0 && <option value="assign">Reassign</option>}
          <option value="delete">Delete</option>
        </select>

        {actionType === 'status' && (
          <select
            value={actionValue}
            onChange={(e) => setActionValue(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
          >
            <option value="">Select status...</option>
            {statusOptions.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}

        {actionType === 'priority' && (
          <select
            value={actionValue}
            onChange={(e) => setActionValue(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
          >
            <option value="">Select priority...</option>
            {priorityOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        {actionType === 'assign' && (
          <select
            value={actionValue}
            onChange={(e) => setActionValue(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
          >
            <option value="">Select user...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        {actionType === 'delete' ? (
          <button
            onClick={() => onAction('delete')}
            className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          >
            Delete {selectedCount} {entityType}
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={!actionType || (actionType !== 'delete' && !actionValue)}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}
