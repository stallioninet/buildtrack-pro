import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import ProgressBar from '../../components/ui/ProgressBar';
import { formatCurrency, formatDate } from '../../utils/formatters';

/* ─── Progress Ring (SVG) ─── */
function ProgressRing({ value, size = 100, stroke = 8, color = '#3b82f6' }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="text-lg font-bold fill-slate-800"
        transform={`rotate(90 ${size / 2} ${size / 2})`}>{value}%</text>
    </svg>
  );
}

/* ─── Create Project Modal ─── */
const TEAM_ROLES = [
  { value: 'pm', label: 'Project Manager' },
  { value: 'engineer', label: 'Site Engineer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'procurement', label: 'Procurement Officer' },
  { value: 'accounts', label: 'Accounts Manager' },
  { value: 'inspector', label: 'Quality Inspector' },
];

function ProjectCreateModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', location: '', plot_size: '', start_date: '', planned_end: '', total_budget: '' });
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [saving, setSaving] = useState(false);

  const goToStep2 = async () => {
    setLoadingTeam(true);
    try {
      const members = await api.get('/auth/team');
      setTeamMembers(members.filter(m => m.is_active));
    } catch (err) { console.error(err); }
    finally { setLoadingTeam(false); }
    setStep(2);
  };

  const handleStep1Submit = (e) => { e.preventDefault(); goToStep2(); };

  const addAssignment = (memberId) => {
    if (assignments.find(a => a.user_id === memberId)) return;
    const member = teamMembers.find(m => m.id === memberId);
    setAssignments([...assignments, { user_id: memberId, role: member?.role || 'engineer', name: member?.name }]);
  };
  const updateAssignmentRole = (userId, role) => {
    setAssignments(assignments.map(a => a.user_id === userId ? { ...a, role } : a));
  };
  const removeAssignment = (userId) => {
    setAssignments(assignments.filter(a => a.user_id !== userId));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const project = await api.post('/projects', { ...form, total_budget: Number(form.total_budget) || 0 });
      for (const a of assignments) {
        try { await api.post(`/projects/${project.id}/members`, { user_id: a.user_id, role: a.role }); }
        catch (err) { console.error('Failed to assign member:', a.name, err); }
      }
      onCreated();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const assignedIds = assignments.map(a => a.user_id);
  const availableMembers = teamMembers.filter(m => !assignedIds.includes(m.id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-600'}`}>
              {step > 1 ? '\u2713' : '1'}
            </span>
            <span className="text-sm font-medium">Details</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className={`flex items-center gap-2 ${step === 2 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
            <span className="text-sm font-medium">Team</span>
          </div>
        </div>

        {step === 1 && (
          <>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Project Details</h3>
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                  <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Plot Size</label>
                  <input type="text" value={form.plot_size} onChange={e => setForm({ ...form, plot_size: e.target.value })}
                    placeholder="e.g. 2400 sqft" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Planned End</label>
                  <input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget (INR)</label>
                <input type="number" value={form.total_budget} onChange={e => setForm({ ...form, total_budget: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Next: Assign Team
                </button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Assign Team Members</h3>
            <p className="text-sm text-slate-500 mb-4">Optional — you can also assign members later from the Team page.</p>
            {loadingTeam ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading team members...</div>
            ) : (
              <>
                {availableMembers.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Add Member</label>
                    <select value="" onChange={(e) => { if (e.target.value) addAssignment(Number(e.target.value)); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Select a team member...</option>
                      {availableMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.roleDisplayName || m.role})</option>
                      ))}
                    </select>
                  </div>
                )}
                {teamMembers.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-sm text-slate-400">No team members found.</p>
                    <p className="text-xs text-slate-400 mt-1">Create team members from the Team page first.</p>
                  </div>
                )}
                {assignments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <label className="block text-sm font-medium text-slate-700">Assigned ({assignments.length})</label>
                    {assignments.map(a => {
                      const member = teamMembers.find(m => m.id === a.user_id);
                      return (
                        <div key={a.user_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {member?.avatarCode || member?.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
                          </div>
                          <select value={a.role} onChange={(e) => updateAssignmentRole(a.user_id, e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <button onClick={() => removeAssignment(a.user_id)}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Back</button>
              <button type="button" onClick={handleCreate} disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating...' : assignments.length > 0 ? `Create with ${assignments.length} Member${assignments.length > 1 ? 's' : ''}` : 'Skip & Create'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Owner Portal: Project Detail View ─── */
function OwnerProjectDetail({ projectId, onBack }) {
  const { data, loading } = useApi(`/dashboard?project_id=${projectId}`);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading project details...</div>;
  if (!data) return <div className="text-center py-16 text-red-500">Failed to load project</div>;

  const { project, stages, stats, milestones, recentAudit, pendingChangeOrders, pendingRaBills, keyDocuments, qualitySummary } = data;
  const budgetPct = stats?.totalBudget > 0 ? Math.round((stats.totalSpent / stats.totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back + Project Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{project?.name}</h1>
          <p className="text-sm text-slate-500">{project?.location}{project?.plot_size ? ` | ${project.plot_size}` : ''}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${project?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
          {project?.status}
        </span>
      </div>

      {/* Top Cards: Progress + Budget + Quality */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-6">
          <ProgressRing value={project?.completion || 0} size={90} stroke={7} color={project?.completion >= 80 ? '#10b981' : '#3b82f6'} />
          <div>
            <p className="text-sm text-slate-500">Overall Progress</p>
            <p className="text-2xl font-bold text-slate-800">{project?.completion || 0}%</p>
            <p className="text-xs text-slate-400 mt-1">{stats?.activeStages}/{stats?.totalStages} stages active</p>
          </div>
        </div>

        {/* Budget */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-2">Budget</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-800">{formatCurrency(stats?.totalSpent)}</span>
            <span className="text-sm text-slate-400 mb-0.5">of {formatCurrency(stats?.totalBudget)}</span>
          </div>
          <ProgressBar value={budgetPct} />
          <p className="text-xs text-slate-400 mt-2">{budgetPct}% utilized | Remaining: {formatCurrency((stats?.totalBudget || 0) - (stats?.totalSpent || 0))}</p>
        </div>

        {/* Quality Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-3">Quality & Issues</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Open NCRs</span>
              <span className={`font-semibold ${qualitySummary?.openNCRs > 0 ? 'text-red-600' : 'text-green-600'}`}>{qualitySummary?.openNCRs || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Open RFIs</span>
              <span className={`font-semibold ${qualitySummary?.openRFIs > 0 ? 'text-amber-600' : 'text-green-600'}`}>{qualitySummary?.openRFIs || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Punch Items</span>
              <span className={`font-semibold ${qualitySummary?.openPunchItems > 0 ? 'text-orange-600' : 'text-green-600'}`}>{qualitySummary?.openPunchItems || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Open Defects</span>
              <span className={`font-semibold ${stats?.openDefects > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats?.openDefects || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Milestone Timeline</h3>
        <div className="space-y-0">
          {(milestones || stages)?.map((stage, idx) => {
            const isComplete = stage.completion === 100;
            const isActive = stage.status === 'in_progress';
            return (
              <div key={stage.id} className="flex items-start gap-4">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${isComplete ? 'bg-green-500 border-green-500' : isActive ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`} />
                  {idx < ((milestones || stages)?.length || 0) - 1 && (
                    <div className={`w-0.5 h-10 ${isComplete ? 'bg-green-300' : 'bg-slate-200'}`} />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 flex items-center justify-between pb-3 -mt-0.5">
                  <div>
                    <p className={`text-sm font-medium ${isActive ? 'text-blue-700' : isComplete ? 'text-green-700' : 'text-slate-600'}`}>
                      {stage.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {stage.start_date ? formatDate(stage.start_date) : 'Not started'}
                      {stage.end_date ? ` — ${formatDate(stage.end_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <ProgressBar value={stage.completion} />
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{stage.completion}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Approvals + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Pending Approvals</h3>
          {(pendingChangeOrders?.length || 0) + (pendingRaBills?.length || 0) === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 mx-auto mb-2 bg-green-50 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingChangeOrders?.map(co => (
                <div key={`co-${co.id}`} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{co.title}</p>
                    <p className="text-xs text-slate-400">{co.co_code} | Cost impact: {formatCurrency(co.cost_impact)}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{co.status}</span>
                </div>
              ))}
              {pendingRaBills?.map(bill => (
                <div key={`ra-${bill.id}`} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{bill.title}</p>
                    <p className="text-xs text-slate-400">{bill.bill_code} | Net: {formatCurrency(bill.net_payable)}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{bill.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Documents */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Key Documents</h3>
          {keyDocuments?.length > 0 ? (
            <div className="space-y-2.5">
              {keyDocuments.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-400">{doc.doc_code} | {doc.category} | Rev {doc.revision}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${doc.status === 'Approved' ? 'bg-green-100 text-green-700' : doc.status === 'Under Review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 py-4 text-center">No documents yet</p>}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Recent Activity</h3>
        {recentAudit?.length > 0 ? (
          <div className="space-y-3">
            {recentAudit.map(entry => (
              <div key={entry.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${entry.type === 'workflow' ? 'bg-blue-500' : entry.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <div className="flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{entry.user_display}</span> {entry.action} {entry.entity} <span className="font-mono text-xs text-blue-600">{entry.entity_id}</span>
                    {entry.from_state && entry.to_state && <span className="text-slate-400"> ({entry.from_state} &rarr; {entry.to_state})</span>}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(entry.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>}
      </div>

      {/* Budget by Stage */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Budget by Stage</h3>
        <div className="space-y-3">
          {stages?.filter(s => s.budget > 0).map(stage => {
            const pct = stage.budget > 0 ? Math.round((stage.spent / stage.budget) * 100) : 0;
            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">{stage.name}</span>
                  <span className="text-xs text-slate-400">{formatCurrency(stage.spent)} / {formatCurrency(stage.budget)}</span>
                </div>
                <ProgressBar value={pct} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Owner Dashboard (Portal) ─── */
export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useApi('/dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = useCallback(() => { refetch(); }, [refetch]);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading your portal...</div>;
  if (!data) return <div className="text-center py-16 text-red-500">Failed to load dashboard</div>;

  if (selectedProjectId) {
    return <OwnerProjectDetail projectId={selectedProjectId} onBack={() => setSelectedProjectId(null)} />;
  }

  const { projects, portalStats, recentActivity, pendingDocs } = data;
  const stats = portalStats || {};

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 md:p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Welcome back</h1>
            <p className="text-blue-100 mt-1">{projects?.length || 0} project{(projects?.length || 0) !== 1 ? 's' : ''} under management</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-blue-200 text-xs">Total Investment</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(stats.totalInvestment)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-blue-200 text-xs">Total Spent</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(stats.totalSpent)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-blue-200 text-xs">Avg. Progress</p>
            <p className="text-xl font-bold mt-1">{stats.avgCompletion || 0}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-blue-200 text-xs">Pending Approvals</p>
            <p className="text-xl font-bold mt-1">{stats.pendingApprovals || 0}</p>
          </div>
        </div>
      </div>

      {/* Attention Needed */}
      {stats.pendingApprovals > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z" />
            </svg>
            Needs Your Attention
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.pendingChangeOrders > 0 && (
              <button onClick={() => navigate('/change-orders')} className="flex items-center gap-2 text-left p-2.5 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">{stats.pendingChangeOrders}</span>
                <span className="text-xs text-amber-800 font-medium">Change Orders</span>
              </button>
            )}
            {stats.pendingRaBills > 0 && (
              <button onClick={() => navigate('/ra-bills')} className="flex items-center gap-2 text-left p-2.5 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">{stats.pendingRaBills}</span>
                <span className="text-xs text-amber-800 font-medium">RA Bills</span>
              </button>
            )}
            {stats.openNCRs > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-amber-200">
                <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">{stats.openNCRs}</span>
                <span className="text-xs text-amber-800 font-medium">Open NCRs</span>
              </div>
            )}
            {stats.openPunchItems > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-amber-200">
                <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">{stats.openPunchItems}</span>
                <span className="text-xs text-amber-800 font-medium">Punch Items</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Cards */}
      {projects && projects.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(project => {
              const budgetPct = project.total_budget > 0 ? Math.round((project.spent / project.total_budget) * 100) : 0;
              return (
                <div key={project.id} onClick={() => setSelectedProjectId(project.id)}
                  className="bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-blue-300 cursor-pointer transition-all overflow-hidden">
                  {/* Color bar based on progress */}
                  <div className="h-1.5" style={{ background: `linear-gradient(to right, #3b82f6 ${project.completion}%, #e2e8f0 ${project.completion}%)` }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-800">{project.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{project.location || 'No location'}</p>
                      </div>
                      <ProgressRing value={project.completion || 0} size={52} stroke={4}
                        color={project.completion >= 80 ? '#10b981' : project.completion >= 40 ? '#3b82f6' : '#f59e0b'} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Budget</p>
                        <p className="font-semibold text-slate-700">{formatCurrency(project.total_budget)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Spent ({budgetPct}%)</p>
                        <p className="font-semibold text-slate-700">{formatCurrency(project.spent)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                      <span>{project.activeStages}/{project.totalStages} stages active</span>
                      {project.planned_end && <span>Due: {formatDate(project.planned_end)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-slate-600 mb-2">No projects yet</h3>
          <p className="text-sm text-slate-400 mb-4">Create your first construction project to get started</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Create Project</button>
        </div>
      )}

      {/* Bottom: Activity + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Recent Activity</h3>
          {recentActivity?.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map(entry => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${entry.type === 'workflow' ? 'bg-blue-500' : entry.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">{entry.user_display}</span> {entry.action} {entry.entity} <span className="font-mono text-xs text-blue-600">{entry.entity_id}</span>
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>}
        </div>

        {/* Documents Needing Review */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">Documents</h3>
            <button onClick={() => navigate('/documents')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all</button>
          </div>
          {pendingDocs?.length > 0 ? (
            <div className="space-y-2.5">
              {pendingDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-400">{doc.doc_code} | {doc.category}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${doc.status === 'Under Review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 text-center py-4">No documents pending review</p>}
        </div>
      </div>

      {showCreate && (
        <ProjectCreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadProjects(); }} />
      )}
    </div>
  );
}
