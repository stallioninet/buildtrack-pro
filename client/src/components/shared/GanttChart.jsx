import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { TASK_STATUS_LABELS, PRIORITY_COLORS } from '../../config/constants';
import { formatDate } from '../../utils/formatters';

const STATUS_BAR_COLORS = {
  not_started: { bg: 'bg-slate-300', fill: '#94a3b8' },
  in_progress: { bg: 'bg-blue-500', fill: '#3b82f6' },
  on_hold: { bg: 'bg-yellow-500', fill: '#eab308' },
  ready_for_inspection: { bg: 'bg-purple-500', fill: '#8b5cf6' },
  rework: { bg: 'bg-orange-500', fill: '#f97316' },
  completed: { bg: 'bg-green-500', fill: '#22c55e' },
};

const DAY_MS = 86400000;

function getDaysBetween(start, end) {
  return Math.ceil((end - start) / DAY_MS);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatShortDate(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function GanttChart({ tasks, stages, onEdit, onStatusChange, canEdit, canChangeStatus }) {
  const [zoom, setZoom] = useState('week'); // 'day', 'week', 'month'
  const [hoveredTask, setHoveredTask] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const scrollRef = useRef(null);
  const headerRef = useRef(null);

  // Flatten tasks (include subtasks as indented rows)
  const flatTasks = useMemo(() => {
    const result = [];
    for (const task of tasks) {
      result.push({ ...task, indent: 0 });
      if (task.subtasks?.length) {
        for (const sub of task.subtasks) {
          result.push({ ...sub, indent: 1 });
        }
      }
    }
    return result;
  }, [tasks]);

  // Calculate date range from tasks and stages
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let min = new Date(today);
    let max = new Date(today);

    // Consider all task dates
    for (const task of flatTasks) {
      const start = parseDate(task.start_date);
      const end = parseDate(task.due_date);
      if (start && start < min) min = new Date(start);
      if (end && end > max) max = new Date(end);
      if (start && start > max) max = new Date(start);
      if (end && end < min) min = new Date(end);
    }

    // Consider stage dates
    for (const stage of (stages || [])) {
      const start = parseDate(stage.start_date);
      const end = parseDate(stage.end_date);
      if (start && start < min) min = new Date(start);
      if (end && end > max) max = new Date(end);
    }

    // Add padding
    min = addDays(min, -7);
    max = addDays(max, 14);

    const days = Math.max(30, getDaysBetween(min, max));
    return { minDate: min, maxDate: max, totalDays: days };
  }, [flatTasks, stages]);

  // Column width based on zoom
  const colWidth = zoom === 'day' ? 36 : zoom === 'week' ? 20 : 8;
  const chartWidth = totalDays * colWidth;
  const ROW_HEIGHT = 36;
  const LABEL_WIDTH = 280;

  // Generate time columns for header
  const timeColumns = useMemo(() => {
    const cols = [];
    const topRow = []; // months or weeks
    let current = new Date(minDate);

    if (zoom === 'month') {
      // Show months in top, weeks in bottom
      let lastMonth = -1;
      for (let d = 0; d < totalDays; d++) {
        const date = addDays(minDate, d);
        const month = date.getMonth();
        const year = date.getFullYear();
        if (month !== lastMonth) {
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          topRow.push({ label: `${months[month]} ${year}`, startDay: d, width: 0 });
          lastMonth = month;
        }
        if (topRow.length > 0) topRow[topRow.length - 1].width += colWidth;

        if (date.getDay() === 1 || d === 0) {
          cols.push({ label: date.getDate().toString(), day: d, isWeekend: false });
        }
      }
    } else if (zoom === 'week') {
      let lastMonth = -1;
      for (let d = 0; d < totalDays; d++) {
        const date = addDays(minDate, d);
        const month = date.getMonth();
        const year = date.getFullYear();
        if (month !== lastMonth) {
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          topRow.push({ label: `${months[month]} ${year}`, startDay: d, width: 0 });
          lastMonth = month;
        }
        if (topRow.length > 0) topRow[topRow.length - 1].width += colWidth;

        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        cols.push({ label: date.getDate().toString(), day: d, isWeekend, date });
      }
    } else {
      // Day zoom
      let lastMonth = -1;
      for (let d = 0; d < totalDays; d++) {
        const date = addDays(minDate, d);
        const month = date.getMonth();
        const year = date.getFullYear();
        if (month !== lastMonth) {
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          topRow.push({ label: `${months[month]} ${year}`, startDay: d, width: 0 });
          lastMonth = month;
        }
        if (topRow.length > 0) topRow[topRow.length - 1].width += colWidth;

        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        cols.push({ label: `${date.getDate()}`, dayName: dayNames[date.getDay()], day: d, isWeekend, date });
      }
    }

    return { cols, topRow };
  }, [minDate, totalDays, colWidth, zoom]);

  // Today marker position
  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = getDaysBetween(minDate, today);
    if (days < 0 || days > totalDays) return null;
    return days * colWidth;
  }, [minDate, totalDays, colWidth]);

  // Calculate bar position for a task
  const getBarProps = useCallback((task) => {
    const start = parseDate(task.start_date);
    const end = parseDate(task.due_date);
    if (!start && !end) return null;

    const barStart = start || end;
    const barEnd = end || addDays(start, 1);

    const startDay = getDaysBetween(minDate, barStart);
    const duration = Math.max(1, getDaysBetween(barStart, barEnd));

    const left = startDay * colWidth;
    const width = Math.max(colWidth, duration * colWidth);

    const colors = STATUS_BAR_COLORS[task.status] || STATUS_BAR_COLORS.not_started;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = barEnd < today && task.status !== 'completed';

    return { left, width, colors, isOverdue, startDay, duration };
  }, [minDate, colWidth]);

  const handleBarHover = useCallback((e, task) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      task,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setHoveredTask(task.id);
  }, []);

  const handleBarLeave = useCallback(() => {
    setTooltip(null);
    setHoveredTask(null);
  }, []);

  // Sync horizontal scroll between header and body
  const handleScroll = useCallback(() => {
    if (scrollRef.current && headerRef.current) {
      headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, []);

  // Tasks with no dates
  const unscheduled = flatTasks.filter(t => !t.start_date && !t.due_date);
  const scheduled = flatTasks.filter(t => t.start_date || t.due_date);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-slate-500">
            {scheduled.length} scheduled, {unscheduled.length} unscheduled
          </span>
          <div className="flex items-center gap-1">
            {['completed', 'in_progress', 'not_started', 'on_hold', 'rework'].map(s => (
              <div key={s} className="flex items-center gap-1 mr-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_BAR_COLORS[s].bg}`} />
                <span className="text-[10px] text-slate-500">{TASK_STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
          {[
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
          ].map(z => (
            <button
              key={z.key}
              onClick={() => setZoom(z.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                zoom === z.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex" style={{ height: Math.min(600, (scheduled.length + 1) * ROW_HEIGHT + 56) }}>
        {/* Left panel — task labels */}
        <div className="flex-shrink-0 border-r border-slate-200 bg-white" style={{ width: LABEL_WIDTH }}>
          {/* Label header */}
          <div className="h-14 border-b border-slate-200 flex items-end px-3 pb-2 bg-slate-50">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Task</span>
          </div>
          {/* Task labels */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - 56px)` }}>
            {scheduled.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2 px-3 border-b border-slate-50 hover:bg-blue-50/50 transition-colors ${
                  hoveredTask === task.id ? 'bg-blue-50/50' : ''
                }`}
                style={{ height: ROW_HEIGHT, paddingLeft: task.indent ? 32 : 12 }}
              >
                {task.indent > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400">{task.task_code}</span>
                    <span
                      className="text-xs text-slate-700 truncate cursor-pointer hover:text-blue-600"
                      onClick={() => canEdit && onEdit(task)}
                      title={task.title}
                    >
                      {task.title}
                    </span>
                  </div>
                </div>
                {task.assigned_to_name && (
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0" title={task.assigned_to_name}>
                    <span className="text-[8px] font-bold text-blue-600">{task.assigned_to_name.charAt(0)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — Gantt bars */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Time header */}
          <div ref={headerRef} className="overflow-hidden flex-shrink-0 border-b border-slate-200 bg-slate-50" style={{ height: 56 }}>
            <div style={{ width: chartWidth, minWidth: '100%' }}>
              {/* Top row — months */}
              <div className="flex h-7 border-b border-slate-100">
                {timeColumns.topRow.map((col, i) => (
                  <div
                    key={i}
                    className="flex items-center px-2 border-r border-slate-100 text-[10px] font-semibold text-slate-600"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
              {/* Bottom row — days/weeks */}
              <div className="flex h-7">
                {timeColumns.cols.map((col, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center border-r text-[9px] ${
                      col.isWeekend ? 'bg-slate-100/50 text-slate-400 border-slate-100' : 'text-slate-500 border-slate-50'
                    }`}
                    style={{ width: colWidth, minWidth: colWidth }}
                  >
                    {zoom === 'day' ? (
                      <div className="text-center leading-none">
                        <div className="text-[8px] text-slate-400">{col.dayName}</div>
                        <div>{col.label}</div>
                      </div>
                    ) : col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart body */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto"
            onScroll={handleScroll}
          >
            <div className="relative" style={{ width: chartWidth, minWidth: '100%', height: scheduled.length * ROW_HEIGHT }}>
              {/* Weekend columns */}
              {timeColumns.cols.filter(c => c.isWeekend).map((col, i) => (
                <div
                  key={`w-${i}`}
                  className="absolute top-0 bottom-0 bg-slate-50/70"
                  style={{ left: col.day * colWidth, width: colWidth }}
                />
              ))}

              {/* Today line */}
              {todayOffset !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                  style={{ left: todayOffset }}
                >
                  <div className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-b">
                    Today
                  </div>
                </div>
              )}

              {/* Row lines */}
              {scheduled.map((_, i) => (
                <div
                  key={`row-${i}`}
                  className="absolute left-0 right-0 border-b border-slate-50"
                  style={{ top: (i + 1) * ROW_HEIGHT }}
                />
              ))}

              {/* Task bars */}
              {scheduled.map((task, rowIndex) => {
                const bar = getBarProps(task);
                if (!bar) return null;

                return (
                  <div
                    key={task.id}
                    className="absolute flex items-center"
                    style={{
                      top: rowIndex * ROW_HEIGHT + 6,
                      left: bar.left,
                      width: bar.width,
                      height: ROW_HEIGHT - 12,
                    }}
                  >
                    <div
                      className={`h-full w-full rounded-md ${bar.colors.bg} ${
                        bar.isOverdue ? 'ring-2 ring-red-400 ring-offset-1' : ''
                      } ${hoveredTask === task.id ? 'brightness-110 shadow-md' : ''} transition-all cursor-pointer relative group`}
                      style={{ opacity: task.status === 'completed' ? 0.7 : 1 }}
                      onMouseEnter={(e) => handleBarHover(e, task)}
                      onMouseLeave={handleBarLeave}
                      onClick={() => canEdit && onEdit(task)}
                    >
                      {/* Progress fill for tasks with subtasks */}
                      {task.subtasks?.length > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-l-md bg-white/20"
                          style={{
                            width: `${(task.subtasks.filter(s => s.status === 'completed').length / task.subtasks.length) * 100}%`,
                          }}
                        />
                      )}
                      {/* Bar label (show on wider bars) */}
                      {bar.width > 60 && (
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white font-medium truncate">
                          {task.task_code}
                        </span>
                      )}
                      {/* Completed stripe pattern */}
                      {task.status === 'completed' && (
                        <div className="absolute inset-0 rounded-md opacity-20"
                          style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Unscheduled tasks */}
      {unscheduled.length > 0 && (
        <div className="border-t border-slate-200 p-3 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs font-medium text-amber-700">
              {unscheduled.length} task{unscheduled.length !== 1 ? 's' : ''} without dates
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map(t => (
              <span
                key={t.id}
                className="text-[10px] bg-white border border-amber-200 text-amber-800 px-2 py-1 rounded cursor-pointer hover:bg-amber-100"
                onClick={() => canEdit && onEdit(t)}
                title="Click to edit and add dates"
              >
                {t.task_code} — {t.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 text-white rounded-lg shadow-xl px-3 py-2.5 pointer-events-none"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 260),
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            maxWidth: 260,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-400">{tooltip.task.task_code}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              STATUS_BAR_COLORS[tooltip.task.status]?.bg || 'bg-slate-500'
            } text-white`}>
              {TASK_STATUS_LABELS[tooltip.task.status]}
            </span>
          </div>
          <p className="text-xs font-medium mb-1.5">{tooltip.task.title}</p>
          <div className="space-y-0.5 text-[10px] text-slate-300">
            {tooltip.task.start_date && <div>Start: {formatDate(tooltip.task.start_date)}</div>}
            {tooltip.task.due_date && <div>Due: {formatDate(tooltip.task.due_date)}</div>}
            {tooltip.task.assigned_to_name && <div>Assigned: {tooltip.task.assigned_to_name}</div>}
            {tooltip.task.stage_name && <div>Stage: {tooltip.task.stage_name}</div>}
          </div>
          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
        </div>
      )}
    </div>
  );
}

export default memo(GanttChart);
