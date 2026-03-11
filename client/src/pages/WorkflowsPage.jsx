import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

const CATEGORY_META = {
  project: { label: 'Project Management', icon: '📋', desc: 'Core project, stage, and task lifecycle workflows', activeClass: 'bg-blue-600 text-white', inactiveClass: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  quality: { label: 'Quality Control', icon: '✅', desc: 'Inspection, NCR, submittals, and drawing revision workflows', activeClass: 'bg-green-600 text-white', inactiveClass: 'bg-green-50 text-green-700 hover:bg-green-100' },
  financial: { label: 'Financial', icon: '💰', desc: 'Procurement, billing, payments, and expense workflows', activeClass: 'bg-amber-600 text-white', inactiveClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  safety: { label: 'Safety', icon: '🛡️', desc: 'Permit to work and safety incident management', activeClass: 'bg-red-600 text-white', inactiveClass: 'bg-red-50 text-red-700 hover:bg-red-100' },
  document: { label: 'Document Control', icon: '📄', desc: 'RFI, change orders, and variation order workflows', activeClass: 'bg-purple-600 text-white', inactiveClass: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
};

const STATE_COLORS = {
  // Common states
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
  new: 'bg-slate-100 text-slate-700 border-slate-300',
  open: 'bg-blue-100 text-blue-700 border-blue-300',
  active: 'bg-blue-100 text-blue-700 border-blue-300',
  ongoing: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
  // Pending/waiting
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  budget_pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  under_review: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  review: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  awaiting_response: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  scheduled: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  // Approved/success
  approved: 'bg-green-100 text-green-700 border-green-300',
  completed: 'bg-green-100 text-green-700 border-green-300',
  resolved: 'bg-green-100 text-green-700 border-green-300',
  passed: 'bg-green-100 text-green-700 border-green-300',
  paid: 'bg-green-100 text-green-700 border-green-300',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  verified: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  issued: 'bg-teal-100 text-teal-700 border-teal-300',
  // Warnings/holds
  on_hold: 'bg-orange-100 text-orange-700 border-orange-300',
  rework: 'bg-orange-100 text-orange-700 border-orange-300',
  revise_resubmit: 'bg-orange-100 text-orange-700 border-orange-300',
  remediation: 'bg-orange-100 text-orange-700 border-orange-300',
  investigation: 'bg-orange-100 text-orange-700 border-orange-300',
  // Danger/negative
  rejected: 'bg-red-100 text-red-700 border-red-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
  // Closed/archived
  closed: 'bg-slate-200 text-slate-600 border-slate-400',
  archived: 'bg-slate-200 text-slate-600 border-slate-400',
  superseded: 'bg-slate-200 text-slate-600 border-slate-400',
};

const ROLE_COLORS = {
  pm: 'bg-blue-50 text-blue-700',
  owner: 'bg-purple-50 text-purple-700',
  engineer: 'bg-teal-50 text-teal-700',
  contractor: 'bg-orange-50 text-orange-700',
  inspector: 'bg-green-50 text-green-700',
  procurement: 'bg-amber-50 text-amber-700',
  accounts: 'bg-pink-50 text-pink-700',
  safety_officer: 'bg-red-50 text-red-700',
  vendor: 'bg-slate-50 text-slate-700',
};

function getStateColor(state) {
  const key = state.toLowerCase().replace(/[\s/()-]+/g, '_').replace(/_+$/, '');
  return STATE_COLORS[key] || 'bg-slate-100 text-slate-600 border-slate-300';
}

function getRoleColor(role) {
  const key = role.toLowerCase().replace(/[\s/]+/g, '_');
  return ROLE_COLORS[key] || 'bg-slate-50 text-slate-600';
}

function StateBadge({ state, isCurrent, small }) {
  return (
    <span className={`inline-flex items-center px-2.5 ${small ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} rounded-full font-medium border ${getStateColor(state)} ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
      {state}
    </span>
  );
}

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${getRoleColor(role)}`}>
      {role}
    </span>
  );
}

function TransitionArrow({ transition, index }) {
  return (
    <div className="flex items-start gap-3 py-2.5 group">
      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
          {index + 1}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StateBadge state={transition.from} small />
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <StateBadge state={transition.to} small />
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-600 font-medium">{transition.trigger}</span>
          {transition.role && <RoleBadge role={transition.role} />}
        </div>
        {transition.guard && (
          <p className="text-[11px] text-slate-400 mt-0.5 italic">Guard: {transition.guard}</p>
        )}
      </div>
    </div>
  );
}

function WorkflowCard({ workflow, isExpanded, onToggle }) {
  const stateCount = workflow.states.length;
  const transitionCount = workflow.transitions.length;
  const roles = [...new Set(workflow.transitions.map(t => t.role).filter(Boolean))];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-800 truncate">{workflow.name}</h3>
          </div>
          <p className="text-xs text-slate-400">Entity: {workflow.entity}</p>
          {/* State flow preview */}
          <div className="flex items-center gap-1 mt-2.5 flex-wrap">
            {workflow.states.map((state, idx) => (
              <div key={state} className="flex items-center gap-1">
                <StateBadge state={state} isCurrent={state === workflow.currentState} small />
                {idx < stateCount - 1 && (
                  <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{stateCount} states</span>
            <span>·</span>
            <span>{transitionCount} transitions</span>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          {/* Roles involved */}
          {roles.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-2">Roles:</span>
              <div className="inline-flex gap-1.5 flex-wrap">
                {roles.map(r => <RoleBadge key={r} role={r} />)}
              </div>
            </div>
          )}

          {/* Transitions */}
          <div className="px-5 py-3">
            <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Transitions</h4>
            <div className="divide-y divide-slate-100">
              {workflow.transitions.map((t, i) => (
                <TransitionArrow key={i} transition={t} index={i} />
              ))}
            </div>
          </div>

          {/* Rules */}
          {workflow.rules && (
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/30">
              <h4 className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-2">Business Rules</h4>
              <ul className="space-y-1">
                {(Array.isArray(workflow.rules) ? workflow.rules : Object.entries(workflow.rules).map(([k,v]) => `${k}: ${v}`)).map((rule, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                    <span>{typeof rule === 'string' ? rule : JSON.stringify(rule)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blocking conditions */}
          {workflow.blocking && (
            <div className="px-5 py-3 border-t border-slate-100 bg-red-50/30">
              <h4 className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-2">Blocking Conditions</h4>
              <ul className="space-y-1">
                {(Array.isArray(workflow.blocking) ? workflow.blocking : Object.entries(workflow.blocking).map(([k,v]) => `${k}: ${v}`)).map((item, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
                    <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api.get('/workflows')
      .then(data => setWorkflows(data))
      .catch(err => setError(err.message || 'Failed to load workflows'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/workflows/dashboard/${currentProject.id}`)
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, [currentProject?.id]);

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(filteredWorkflows.map(w => w.key)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  // Group by category
  const categories = [...new Set(workflows.map(w => w.category))];

  const filteredWorkflows = workflows.filter(w => {
    const matchesCat = activeCategory === 'all' || w.category === activeCategory;
    const matchesSearch = !searchTerm ||
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const grouped = {};
  filteredWorkflows.forEach(w => {
    if (!grouped[w.category]) grouped[w.category] = [];
    grouped[w.category].push(w);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-2">Failed to load workflows</p>
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  const totalStates = workflows.reduce((sum, w) => sum + w.states.length, 0);
  const totalTransitions = workflows.reduce((sum, w) => sum + w.transitions.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workflow Engine</h1>
          <p className="text-sm text-slate-500 mt-1">
            {workflows.length} workflows · {totalStates} states · {totalTransitions} transitions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'definitions' && (
            <>
              <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
                Expand All
              </button>
              <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100">
                Collapse All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Live Dashboard
        </button>
        <button onClick={() => setActiveTab('definitions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'definitions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Definitions ({workflows.length})
        </button>
        <button onClick={() => setActiveTab('designer')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'designer' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Visual Designer
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <WorkflowDashboard dashboard={dashboard} />
      )}

      {/* Designer Tab */}
      {activeTab === 'designer' && (
        <WorkflowDesigner workflows={workflows} user={user} onRefresh={() => {
          api.get('/workflows').then(setWorkflows).catch(() => {});
        }} />
      )}

      {/* Definitions Tab */}
      {activeTab === 'definitions' && (
      <div className="space-y-6">
      {/* Search + Category tabs */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search workflows..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({workflows.length})
          </button>
          {categories.map(cat => {
            const meta = CATEGORY_META[cat] || { label: cat, icon: '📌', activeClass: 'bg-slate-800 text-white', inactiveClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200' };
            const count = workflows.filter(w => w.category === cat).length;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? meta.activeClass : meta.inactiveClass
                }`}
              >
                {meta.icon} {meta.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow cards by category */}
      {Object.entries(grouped).map(([cat, wfs]) => {
        const meta = CATEGORY_META[cat] || { label: cat, icon: '📌', desc: '' };
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{meta.icon}</span>
              <div>
                <h2 className="text-sm font-semibold text-slate-700">{meta.label}</h2>
                <p className="text-[11px] text-slate-400">{meta.desc}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {wfs.map(wf => (
                <WorkflowCard
                  key={wf.key}
                  workflow={wf}
                  isExpanded={expandedKeys.has(wf.key)}
                  onToggle={() => toggleExpand(wf.key)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filteredWorkflows.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No workflows match your search.
        </div>
      )}
      </div>
      )}
    </div>
  );
}

// ==================== WORKFLOW DASHBOARD ====================

// ==================== VISUAL WORKFLOW DESIGNER ====================

function WorkflowDesigner({ workflows, user, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingWf, setEditingWf] = useState(null);
  const canEdit = ['owner', 'pm'].includes(user?.role);

  const openEditor = (wf) => {
    setEditingWf(wf ? {
      machine_key: wf.key,
      name: wf.name,
      entity: wf.entity,
      category: wf.category,
      states: [...wf.states],
      current_state: wf.currentState,
      transitions: wf.transitions.map(t => ({ ...t })),
      rules: wf.rules ? (Array.isArray(wf.rules) ? [...wf.rules] : Object.entries(wf.rules).map(([k,v]) => `${k}: ${v}`)) : [],
    } : {
      machine_key: '',
      name: '',
      entity: '',
      category: 'general',
      states: ['Draft'],
      current_state: 'Draft',
      transitions: [],
      rules: [],
    });
    setShowEditor(true);
  };

  const handleSave = async (data) => {
    try {
      const payload = {
        ...data,
        rules: data.rules.length > 0 ? data.rules : null,
      };
      if (editingWf?.machine_key && workflows.find(w => w.key === editingWf.machine_key)) {
        await api.patch(`/workflows/${data.machine_key}`, payload);
      } else {
        await api.post('/workflows', payload);
      }
      setShowEditor(false);
      onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to save');
    }
  };

  const handleDelete = async (wf) => {
    if (!confirm(`Delete workflow "${wf.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/workflows/${wf.key}`);
      onRefresh();
      if (selected?.key === wf.key) setSelected(null);
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Visual flow diagrams and workflow editor</p>
        {canEdit && (
          <button onClick={() => openEditor(null)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Workflow
          </button>
        )}
      </div>

      {/* Workflow selector */}
      <div className="flex flex-wrap gap-2">
        {workflows.map(wf => (
          <button key={wf.key} onClick={() => setSelected(wf)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${selected?.key === wf.key ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {wf.name}
          </button>
        ))}
      </div>

      {/* Visual Flow Diagram */}
      {selected ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{selected.name}</h3>
              <p className="text-xs text-slate-400">{selected.entity} · {selected.category} · {selected.states.length} states · {selected.transitions.length} transitions</p>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <button onClick={() => openEditor(selected)} className="text-xs px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">Edit</button>
                <button onClick={() => handleDelete(selected)} className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg">Delete</button>
              </div>
            )}
          </div>

          {/* Flow Diagram */}
          <div className="p-6 overflow-x-auto">
            <FlowDiagram states={selected.states} transitions={selected.transitions} currentState={selected.currentState} />
          </div>

          {/* Transition Table */}
          <div className="p-4 border-t">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Transition Matrix</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">#</th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">From</th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">To</th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">Trigger</th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">Role</th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">Guard</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.transitions.map((t, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5 px-2 text-slate-400">{i + 1}</td>
                      <td className="py-1.5 px-2"><StateBadge state={t.from} small /></td>
                      <td className="py-1.5 px-2"><StateBadge state={t.to} small /></td>
                      <td className="py-1.5 px-2 text-slate-700">{t.trigger}</td>
                      <td className="py-1.5 px-2">{t.role ? <RoleBadge role={t.role} /> : '-'}</td>
                      <td className="py-1.5 px-2 text-slate-400 italic">{t.guard || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Select a workflow above to view its visual flow diagram
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <WorkflowEditorModal
          workflow={editingWf}
          isNew={!workflows.find(w => w.key === editingWf?.machine_key)}
          onClose={() => setShowEditor(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function FlowDiagram({ states, transitions, currentState }) {
  // Build adjacency: for each state, find outgoing transitions
  const outgoing = {};
  states.forEach(s => { outgoing[s] = []; });
  transitions.forEach(t => {
    if (outgoing[t.from]) outgoing[t.from].push(t);
  });

  // Arrange states in rows - try topological-ish order
  const visited = new Set();
  const order = [];
  const visit = (state) => {
    if (visited.has(state)) return;
    visited.add(state);
    order.push(state);
    for (const t of (outgoing[state] || [])) {
      visit(t.to);
    }
  };
  visit(states[0]);
  // Add any remaining
  states.forEach(s => { if (!visited.has(s)) order.push(s); });

  // Layout in rows of 4
  const rows = [];
  for (let i = 0; i < order.length; i += 4) {
    rows.push(order.slice(i, i + 4));
  }

  return (
    <div className="space-y-6">
      {rows.map((row, ri) => (
        <div key={ri} className="flex items-center justify-center gap-3 flex-wrap">
          {row.map((state, si) => {
            const outs = outgoing[state] || [];
            const isCurrent = state === currentState;
            const isTerminal = outs.length === 0;
            return (
              <div key={state} className="flex items-center gap-2">
                <div className={`relative px-4 py-2.5 rounded-xl border-2 text-xs font-medium text-center min-w-[100px] transition-all
                  ${isCurrent ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' :
                    isTerminal ? 'border-slate-400 bg-slate-100 text-slate-600' :
                    'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                  {state}
                  {isCurrent && <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />}
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {outs.length > 0 ? `${outs.length} out` : 'terminal'}
                  </div>
                </div>
                {si < row.length - 1 && (
                  <svg className="w-6 h-6 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-50" /> Current State
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-3 h-3 rounded border-2 border-slate-200 bg-white" /> Active State
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-3 h-3 rounded border-2 border-slate-400 bg-slate-100" /> Terminal State
        </div>
      </div>
    </div>
  );
}

function WorkflowEditorModal({ workflow, isNew, onClose, onSave }) {
  const [form, setForm] = useState({ ...workflow });
  const [newState, setNewState] = useState('');
  const [newTransition, setNewTransition] = useState({ from: '', to: '', trigger: '', role: '', guard: '' });
  const [newRule, setNewRule] = useState('');
  const [saving, setSaving] = useState(false);

  const addState = () => {
    if (!newState.trim() || form.states.includes(newState.trim())) return;
    setForm(f => ({ ...f, states: [...f.states, newState.trim()] }));
    setNewState('');
  };

  const removeState = (state) => {
    setForm(f => ({
      ...f,
      states: f.states.filter(s => s !== state),
      transitions: f.transitions.filter(t => t.from !== state && t.to !== state),
      current_state: f.current_state === state ? (f.states.find(s => s !== state) || '') : f.current_state,
    }));
  };

  const addTransition = () => {
    if (!newTransition.from || !newTransition.to || !newTransition.trigger) return;
    setForm(f => ({ ...f, transitions: [...f.transitions, { ...newTransition }] }));
    setNewTransition({ from: '', to: '', trigger: '', role: '', guard: '' });
  };

  const removeTransition = (idx) => {
    setForm(f => ({ ...f, transitions: f.transitions.filter((_, i) => i !== idx) }));
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    setForm(f => ({ ...f, rules: [...f.rules, newRule.trim()] }));
    setNewRule('');
  };

  const removeRule = (idx) => {
    setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.machine_key || !form.name || !form.entity || form.states.length === 0) {
      return alert('Key, name, entity, and at least one state are required');
    }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{isNew ? 'New Workflow' : `Edit: ${form.name}`}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Key *</label>
              <input type="text" value={form.machine_key} onChange={e => setForm(f => ({ ...f, machine_key: e.target.value }))}
                disabled={!isNew} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 disabled:bg-slate-50"
                placeholder="e.g., my_workflow" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., My Custom Workflow" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Entity *</label>
              <input type="text" value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., task, ncr, rfi" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="general">General</option>
                <option value="project">Project Management</option>
                <option value="quality">Quality Control</option>
                <option value="financial">Financial</option>
                <option value="safety">Safety</option>
                <option value="document">Document Control</option>
              </select>
            </div>
          </div>

          {/* States */}
          <div className="bg-slate-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">States ({form.states.length})</h4>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.states.map(s => (
                <div key={s} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${s === form.current_state ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                  <button onClick={() => setForm(f => ({ ...f, current_state: s }))}
                    title="Set as initial state" className="hover:text-blue-600">{s}</button>
                  <button onClick={() => removeState(s)} className="text-slate-300 hover:text-red-500 ml-1">&times;</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newState} onChange={e => setNewState(e.target.value)}
                placeholder="Add state..." className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                onKeyDown={e => e.key === 'Enter' && addState()} />
              <button onClick={addState} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Add</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Click a state name to set it as the initial state (highlighted in blue)</p>
          </div>

          {/* Transitions */}
          <div className="bg-slate-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Transitions ({form.transitions.length})</h4>
            <div className="space-y-1.5 mb-2">
              {form.transitions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded px-2 py-1.5 border border-slate-100 text-xs">
                  <span className="font-medium text-slate-600">{t.from}</span>
                  <span className="text-slate-300">→</span>
                  <span className="font-medium text-slate-600">{t.to}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-blue-600">{t.trigger}</span>
                  {t.role && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{t.role}</span>}
                  {t.guard && <span className="text-[10px] italic text-slate-400">[{t.guard}]</span>}
                  <button onClick={() => removeTransition(i)} className="ml-auto text-slate-300 hover:text-red-500">&times;</button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              <select value={newTransition.from} onChange={e => setNewTransition(t => ({ ...t, from: e.target.value }))}
                className="text-xs border border-slate-200 rounded px-2 py-1.5">
                <option value="">From...</option>
                {form.states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={newTransition.to} onChange={e => setNewTransition(t => ({ ...t, to: e.target.value }))}
                className="text-xs border border-slate-200 rounded px-2 py-1.5">
                <option value="">To...</option>
                {form.states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" value={newTransition.trigger} onChange={e => setNewTransition(t => ({ ...t, trigger: e.target.value }))}
                placeholder="Trigger" className="text-xs border border-slate-200 rounded px-2 py-1.5" />
              <input type="text" value={newTransition.role} onChange={e => setNewTransition(t => ({ ...t, role: e.target.value }))}
                placeholder="Role (opt)" className="text-xs border border-slate-200 rounded px-2 py-1.5" />
              <button onClick={addTransition} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Add</button>
            </div>
          </div>

          {/* Rules */}
          <div className="bg-slate-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Business Rules ({form.rules.length})</h4>
            <div className="space-y-1 mb-2">
              {form.rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-amber-500">•</span>
                  <span className="flex-1 text-slate-600">{r}</span>
                  <button onClick={() => removeRule(i)} className="text-slate-300 hover:text-red-500">&times;</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newRule} onChange={e => setNewRule(e.target.value)}
                placeholder="Add business rule..." className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                onKeyDown={e => e.key === 'Enter' && addRule()} />
              <button onClick={addRule} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Add</button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isNew ? 'Create Workflow' : 'Update Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowDashboard({ dashboard }) {
  if (!dashboard) {
    return <div className="text-center py-12 text-slate-400 text-sm">Select a project to see workflow dashboard</div>;
  }

  const entityConfigs = [
    { key: 'task', label: 'Tasks', icon: '✓', color: 'blue' },
    { key: 'inspection', label: 'Inspections', icon: '🛡', color: 'indigo' },
    { key: 'defect', label: 'Defects', icon: '!', color: 'red' },
    { key: 'ncr', label: 'NCRs', icon: '⚠', color: 'orange' },
    { key: 'rfi', label: 'RFIs', icon: '?', color: 'purple' },
  ];

  const STATE_BADGE = {
    not_started: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700',
    ready_for_inspection: 'bg-purple-100 text-purple-700',
    rework: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    Scheduled: 'bg-slate-100 text-slate-600',
    'In Progress': 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    Open: 'bg-blue-100 text-blue-700',
    Resolved: 'bg-green-100 text-green-700',
    Identified: 'bg-slate-100 text-slate-700',
    Reported: 'bg-blue-100 text-blue-700',
    'Under Review': 'bg-amber-100 text-amber-700',
    Closed: 'bg-green-100 text-green-700',
    Draft: 'bg-slate-100 text-slate-600',
    Responded: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-6">
      {/* Entity Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entityConfigs.map(cfg => {
          const data = dashboard[cfg.key];
          if (!data || data.total === 0) return null;
          return (
            <div key={cfg.key} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">{cfg.label}</h3>
                <span className="text-lg font-bold text-slate-700">{data.total}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.items.map(item => (
                  <div key={item.status || item.count} className="flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATE_BADGE[item.status] || 'bg-slate-100 text-slate-600'}`}>
                      {item.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottlenecks */}
      {dashboard.bottlenecks?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-3">Bottlenecks (Items stuck &gt; 7 days)</h3>
          <div className="space-y-2">
            {dashboard.bottlenecks.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-red-600">{b.entity_id}</span>
                  <span className="text-xs text-red-700 capitalize">{b.entity}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_BADGE[b.state] || 'bg-red-100 text-red-600'}`}>
                    {b.state?.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs font-bold text-red-600">{b.days_in_state}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transitions */}
      {dashboard.recentTransitions?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Workflow Activity</h3>
          <div className="space-y-2">
            {dashboard.recentTransitions.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-mono text-slate-400">{t.entity_id}</span>
                  <span className="text-[10px] text-slate-500 capitalize">{t.entity}</span>
                  {t.from_state && (
                    <>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_BADGE[t.from_state] || 'bg-slate-100 text-slate-500'}`}>
                        {t.from_state?.replace(/_/g, ' ')}
                      </span>
                      <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_BADGE[t.to_state] || 'bg-slate-100 text-slate-500'}`}>
                    {t.to_state?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-400">{t.user_display}</span>
                  <span className="text-[10px] text-slate-300">{t.timestamp ? formatDate(t.timestamp) : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
