import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { formatDate, statusColor } from '../../utils/formatters';
import { api } from '../../api/client';
import { showError } from '../../utils/toast';

// ─── Widget Registry ────────────────────────────────────────────
// Each widget has: id, label, component, minRoles (which roles can use it)
export const WIDGET_REGISTRY = {
  stat_cards: { label: 'Key Metrics', roles: ['pm', 'engineer', 'contractor', 'accounts', 'inspector', 'owner'] },
  stage_progress: { label: 'Stage Progress', roles: ['pm', 'engineer', 'owner'] },
  upcoming_inspections: { label: 'Upcoming Inspections', roles: ['pm', 'engineer', 'inspector'] },
  recent_tasks: { label: 'Recent Tasks', roles: ['pm', 'engineer', 'contractor'] },
  material_requests: { label: 'Material Requests', roles: ['pm', 'contractor', 'procurement'] },
  recent_expenses: { label: 'Recent Expenses', roles: ['accounts', 'pm', 'owner'] },
  recent_payments: { label: 'Recent Payments', roles: ['accounts', 'pm', 'owner'] },
  quality_summary: { label: 'Quality Summary', roles: ['pm', 'inspector', 'owner', 'engineer'] },
  defect_list: { label: 'Defects', roles: ['inspector', 'engineer'] },
  inspection_list: { label: 'Inspections', roles: ['inspector', 'engineer'] },
  checklist_progress: { label: 'Checklist Progress', roles: ['engineer'] },
};

// ─── Default layouts per role ────────────────────────────────────
export const DEFAULT_LAYOUTS = {
  pm: ['stat_cards', 'stage_progress', 'upcoming_inspections', 'recent_tasks'],
  engineer: ['stat_cards', 'stage_progress', 'checklist_progress', 'upcoming_inspections'],
  contractor: ['stat_cards', 'recent_tasks', 'material_requests'],
  accounts: ['stat_cards', 'recent_expenses', 'recent_payments'],
  inspector: ['stat_cards', 'inspection_list', 'defect_list'],
  procurement: ['stat_cards', 'material_requests'],
  owner: ['stat_cards', 'stage_progress', 'quality_summary'],
};

// ─── Widget Components ───────────────────────────────────────────

export function StageProgressWidget({ stages }) {
  if (!stages?.length) return <EmptyWidget>No stages found</EmptyWidget>;
  return (
    <WidgetCard title="Stage Progress">
      <div className="space-y-3">
        {stages.map(stage => (
          <div key={stage.id} className="py-2 border-b border-slate-100 last:border-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">{stage.name}</span>
              <Badge status={stage.status} />
            </div>
            <ProgressBar value={stage.completion} />
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

export function UpcomingInspectionsWidget({ inspections }) {
  return (
    <WidgetCard title="Upcoming Inspections" link="/quality">
      {!inspections?.length ? <EmptyWidget>No upcoming inspections</EmptyWidget> : (
        <div className="space-y-3">
          {inspections.map(insp => (
            <div key={insp.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <span className="text-sm font-medium text-slate-700">{insp.inspection_code}</span>
                <p className="text-xs text-slate-500">{insp.stage_name} &middot; {insp.type}</p>
              </div>
              <span className="text-xs text-slate-500">{formatDate(insp.inspection_date)}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function RecentTasksWidget({ tasks }) {
  return (
    <WidgetCard title="Recent Tasks" link="/tasks">
      {!tasks?.length ? <EmptyWidget>No recent tasks</EmptyWidget> : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{task.task_code}</span>
                  <span className="text-sm text-slate-700 truncate">{task.title}</span>
                </div>
                <p className="text-xs text-slate-500">{task.stage_name}{task.assigned_to_name ? ` · ${task.assigned_to_name}` : ''}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(task.status)}`}>
                {task.status?.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function MaterialRequestsWidget({ requests }) {
  return (
    <WidgetCard title="Material Requests" link="/inventory">
      {!requests?.length ? <EmptyWidget>No material requests</EmptyWidget> : (
        <div className="space-y-2">
          {requests.map(mr => (
            <div key={mr.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <span className="text-sm text-slate-700">{mr.material_name || mr.item_name || `Request #${mr.id}`}</span>
                <p className="text-xs text-slate-500">{mr.stage_name}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(mr.status)}`}>{mr.status}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function RecentExpensesWidget({ expenses }) {
  return (
    <WidgetCard title="Recent Expenses" link="/expenses">
      {!expenses?.length ? <EmptyWidget>No recent expenses</EmptyWidget> : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <span className="text-sm text-slate-700">{e.description || e.expense_code || `#${e.id}`}</span>
                <p className="text-xs text-slate-500">{e.stage_name} · {e.category}</p>
              </div>
              <span className="text-sm font-medium text-slate-800">₹{(e.amount || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function RecentPaymentsWidget({ payments }) {
  return (
    <WidgetCard title="Recent Payments" link="/payments">
      {!payments?.length ? <EmptyWidget>No recent payments</EmptyWidget> : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <span className="text-sm text-slate-700">{p.vendor_name || p.payment_code || `#${p.id}`}</span>
                <p className="text-xs text-slate-500">{p.stage_name}</p>
              </div>
              <span className="text-sm font-medium text-slate-800">₹{(p.amount || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function QualitySummaryWidget({ summary }) {
  if (!summary) return null;
  return (
    <WidgetCard title="Quality Summary">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{summary.openNCRs || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Open NCRs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">{summary.openRFIs || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Open RFIs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{summary.openPunchItems || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Open Punch Items</div>
        </div>
      </div>
    </WidgetCard>
  );
}

export function DefectListWidget({ defects }) {
  return (
    <WidgetCard title="Recent Defects" link="/quality">
      {!defects?.length ? <EmptyWidget>No defects found</EmptyWidget> : (
        <div className="space-y-2">
          {defects.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <span className="text-sm text-slate-700">{d.description || `Defect #${d.id}`}</span>
                <p className="text-xs text-slate-500">{d.inspection_code}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.status === 'Open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function InspectionListWidget({ inspections }) {
  return (
    <WidgetCard title="Inspections" link="/quality">
      {!inspections?.length ? <EmptyWidget>No inspections found</EmptyWidget> : (
        <div className="space-y-2">
          {inspections.map(i => (
            <div key={i.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <span className="text-sm font-medium text-slate-700">{i.inspection_code}</span>
                <p className="text-xs text-slate-500">{i.stage_name} · {i.type}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(i.status)}`}>{i.status}</span>
                <p className="text-xs text-slate-400 mt-1">{formatDate(i.inspection_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function ChecklistProgressWidget({ substages, progress }) {
  if (!substages?.length) return null;
  return (
    <WidgetCard title="Checklist Progress">
      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600">Overall</span>
            <span className="font-medium text-slate-800">
              {progress.checked}/{progress.total} items checked
            </span>
          </div>
          <ProgressBar value={progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0} />
        </div>
      )}
      <div className="space-y-2">
        {substages.slice(0, 6).map(s => (
          <div key={s.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-700">{s.name}</span>
            <Badge status={s.status} />
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────

function WidgetCard({ title, link, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        {link && (
          <Link to={link} className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyWidget({ children }) {
  return <p className="text-sm text-slate-400 py-4 text-center">{children}</p>;
}

// ─── Widget Picker Modal ────────────────────────────────────────

export function WidgetPicker({ currentLayout, role, onSave, onClose }) {
  const [layout, setLayout] = useState([...currentLayout]);
  const [saving, setSaving] = useState(false);

  const available = Object.entries(WIDGET_REGISTRY)
    .filter(([, w]) => w.roles.includes(role))
    .map(([id, w]) => ({ id, label: w.label }));

  const toggleWidget = (widgetId) => {
    setLayout(prev => {
      if (prev.includes(widgetId)) return prev.filter(id => id !== widgetId);
      return [...prev, widgetId];
    });
  };

  const moveUp = (index) => {
    if (index === 0) return;
    setLayout(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index) => {
    if (index === layout.length - 1) return;
    setLayout(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/dashboard/layout', { layout });
      onSave(layout);
    } catch (err) {
      showError(err.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await api.delete('/dashboard/layout');
      const defaultLayout = DEFAULT_LAYOUTS[role] || ['stat_cards'];
      setLayout(defaultLayout);
      onSave(defaultLayout);
    } catch (err) {
      showError(err.message || 'Failed to reset layout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Customize Dashboard</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active widgets (ordered) */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Active Widgets</p>
            {layout.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No widgets selected. Add some below.</p>
            ) : (
              <div className="space-y-1">
                {layout.map((widgetId, idx) => {
                  const widget = WIDGET_REGISTRY[widgetId];
                  if (!widget) return null;
                  return (
                    <div key={widgetId} className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-lg">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveUp(idx)} disabled={idx === 0}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button onClick={() => moveDown(idx)} disabled={idx === layout.length - 1}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-sm text-slate-700 flex-1">{widget.label}</span>
                      <button onClick={() => toggleWidget(widgetId)} className="text-red-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available widgets not in layout */}
          {available.filter(w => !layout.includes(w.id)).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Available Widgets</p>
              <div className="space-y-1">
                {available.filter(w => !layout.includes(w.id)).map(w => (
                  <div key={w.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">{w.label}</span>
                    <button onClick={() => toggleWidget(w.id)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-between">
          <button onClick={handleReset} disabled={saving}
            className="text-xs text-slate-500 hover:text-slate-700 underline">
            Reset to default
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Layout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Widget Renderer ─────────────────────────────────────────────
// Renders a widget by ID using the provided dashboard data
export function renderWidget(widgetId, data) {
  switch (widgetId) {
    case 'stage_progress':
      return <StageProgressWidget key={widgetId} stages={data.stages} />;
    case 'upcoming_inspections':
      return <UpcomingInspectionsWidget key={widgetId} inspections={data.upcomingInspections} />;
    case 'recent_tasks':
      return <RecentTasksWidget key={widgetId} tasks={data.recentTasks} />;
    case 'material_requests':
      return <MaterialRequestsWidget key={widgetId} requests={data.materialRequests || data.recentRequests} />;
    case 'recent_expenses':
      return <RecentExpensesWidget key={widgetId} expenses={data.recentExpenses} />;
    case 'recent_payments':
      return <RecentPaymentsWidget key={widgetId} payments={data.recentPayments} />;
    case 'quality_summary':
      return <QualitySummaryWidget key={widgetId} summary={data.qualitySummary} />;
    case 'defect_list':
      return <DefectListWidget key={widgetId} defects={data.defects} />;
    case 'inspection_list':
      return <InspectionListWidget key={widgetId} inspections={data.inspections} />;
    case 'checklist_progress':
      return <ChecklistProgressWidget key={widgetId} substages={data.substages} progress={data.checklistProgress} />;
    default:
      return null;
  }
}
