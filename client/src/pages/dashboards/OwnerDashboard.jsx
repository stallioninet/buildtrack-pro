import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { formatCurrency, formatDate } from '../../utils/formatters';

function ProjectCreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', location: '', plot_size: '', start_date: '', planned_end: '', total_budget: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, total_budget: Number(form.total_budget) || 0 };
      const project = await api.post('/projects', body);
      onCreated(project);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Create New Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plot Size</label>
              <input type="text" value={form.plot_size} onChange={(e) => setForm({ ...form, plot_size: e.target.value })}
                placeholder="e.g. 2400 sqft"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Planned End</label>
              <input type="date" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget (INR)</label>
            <input type="number" value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }) {
  const budgetUsed = project.total_budget > 0 ? Math.round((project.spent / project.total_budget) * 100) : 0;
  const statusColors = {
    active: 'bg-green-100 text-green-700',
    planning: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{project.name}</h3>
          <p className="text-sm text-slate-500">{project.location || 'No location'}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || 'bg-slate-100 text-slate-600'}`}>
          {project.status}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Progress</span>
            <span className="font-medium text-slate-700">{project.completion}%</span>
          </div>
          <ProgressBar value={project.completion} />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-xs text-slate-400">Budget</p>
            <p className="text-sm font-semibold text-slate-700">{formatCurrency(project.total_budget)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Spent</p>
            <p className="text-sm font-semibold text-slate-700">{formatCurrency(project.spent)} <span className="text-xs text-slate-400">({budgetUsed}%)</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Plot Size</p>
            <p className="text-sm text-slate-600">{project.plot_size || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Stages</p>
            <p className="text-sm text-slate-600">{project.activeStages || 0} active / {project.totalStages || 0} total</p>
          </div>
        </div>

        {project.start_date && (
          <div className="flex items-center gap-4 pt-1 text-xs text-slate-400">
            <span>Start: {formatDate(project.start_date)}</span>
            {project.planned_end && <span>End: {formatDate(project.planned_end)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectDetail({ projectId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/dashboard?project_id=${projectId}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading project...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load project</div>;

  const { project, stages, stats, recentAudit } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{project?.name}</h1>
          <p className="text-sm text-slate-500">{project?.location} | {project?.plot_size}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Budget" value={formatCurrency(stats?.totalBudget)} color="blue" />
        <StatCard label="Total Spent" value={formatCurrency(stats?.totalSpent)} sub={`${Math.round((stats?.totalSpent / stats?.totalBudget) * 100 || 0)}% utilized`} color="green" />
        <StatCard label="Overall Progress" value={`${stats?.completion || 0}%`} sub={`${stats?.activeStages}/${stats?.totalStages} stages active`} color="purple" />
        <StatCard label="Pending Approvals" value={stats?.pendingApprovals || 0} sub={`${stats?.openDefects} open defects`} color="orange" />
      </div>

      {/* Project Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Project Progress</h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <ProgressBar value={project?.completion || 0} />
          </div>
          <span className="text-sm font-medium text-slate-600">{project?.completion || 0}%</span>
        </div>

        <div className="space-y-3">
          {stages?.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-6">{stage.stage_order}</span>
                <span className="text-sm font-medium text-slate-700">{stage.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32">
                  <ProgressBar value={stage.completion} />
                </div>
                <span className="text-xs text-slate-500 w-10 text-right">{stage.completion}%</span>
                <Badge status={stage.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget & Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Budget by Stage</h3>
          <div className="space-y-3">
            {stages?.filter(s => s.budget > 0).map((stage) => (
              <div key={stage.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 truncate flex-1">{stage.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-800">{formatCurrency(stage.budget)}</span>
                  <span className="text-xs text-slate-400">spent {formatCurrency(stage.spent)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentAudit?.length > 0 ? recentAudit.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${entry.type === 'workflow' ? 'bg-blue-500' : entry.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{entry.action} - {entry.entity} {entry.entity_id}</p>
                  <p className="text-xs text-slate-400">{entry.user_display} | {formatDate(entry.timestamp)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = useCallback(() => {
    setLoading(true);
    api.get('/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  // If a project is selected, show project detail
  if (selectedProjectId) {
    return <ProjectDetail projectId={selectedProjectId} onBack={() => setSelectedProjectId(null)} />;
  }

  const { projects } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Owner Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{projects?.length || 0} project{(projects?.length || 0) !== 1 ? 's' : ''} under management</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Summary stats across all projects */}
      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Projects" value={projects.length} color="blue" />
          <StatCard label="Active Projects" value={projects.filter(p => p.status === 'active').length} color="green" />
          <StatCard label="Total Investment" value={formatCurrency(projects.reduce((s, p) => s + (p.total_budget || 0), 0))} color="purple" />
          <StatCard label="Total Spent" value={formatCurrency(projects.reduce((s, p) => s + (p.spent || 0), 0))} color="orange" />
        </div>
      )}

      {/* Project cards */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => setSelectedProjectId(project.id)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-slate-600 mb-2">No projects yet</h3>
          <p className="text-sm text-slate-400 mb-4">Create your first construction project to get started</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Create Project
          </button>
        </div>
      )}

      {showCreate && (
        <ProjectCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadProjects(); }}
        />
      )}
    </div>
  );
}
