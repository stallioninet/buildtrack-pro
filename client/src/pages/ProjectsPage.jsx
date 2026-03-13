import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import ProgressBar from '../components/ui/ProgressBar';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ROLE_LABELS } from '../config/navigation';
import { PROJECT_STATUS_COLORS } from '../config/constants';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';

function ProjectMembersModal({ project, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${project.id}/members`).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [project.id]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6">Loading...</div>
    </div>
  );

  const roleColors = {
    owner: 'bg-purple-100 text-purple-700',
    pm: 'bg-blue-100 text-blue-700',
    engineer: 'bg-green-100 text-green-700',
    contractor: 'bg-orange-100 text-orange-700',
    procurement: 'bg-teal-100 text-teal-700',
    accounts: 'bg-indigo-100 text-indigo-700',
    inspector: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Team — {project.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* Owner */}
          {data?.owner && (
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-xs font-bold text-purple-700">
                  {data.owner.avatarCode || data.owner.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{data.owner.name}</p>
                  <p className="text-xs text-slate-500">{data.owner.email}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Owner</span>
            </div>
          )}

          {/* Members */}
          {data?.members?.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {m.avatarCode || m.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[m.project_role] || 'bg-slate-100 text-slate-600'}`}>
                {ROLE_LABELS[m.project_role] || m.project_role}
              </span>
            </div>
          ))}

          {(!data?.members || data.members.length === 0) && (
            <p className="text-sm text-slate-400 text-center py-4">No team members assigned yet</p>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { projects, currentProject, refreshProjects, selectProject, loading } = useProject();
  const [showMembers, setShowMembers] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const handleViewStages = (p) => {
    selectProject(p);
    navigate('/stages');
  };

  if (user?.role !== 'owner') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">My Projects</h1>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500">No projects assigned to you.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} isSelected={currentProject?.id === p.id}
                onSelect={() => selectProject(p)} onViewStages={() => handleViewStages(p)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const statusColors = PROJECT_STATUS_COLORS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Project</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Progress</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Budget</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Team</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Timeline</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map(p => {
              const isSelected = currentProject?.id === p.id;
              return (
                <tr key={p.id} className={isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.location || '-'} | {p.plot_size || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || 'bg-slate-100 text-slate-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24">
                      <ProgressBar value={p.completion} />
                      <span className="text-xs text-slate-500">{p.completion}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{formatCurrency(p.total_budget)}</p>
                    <p className="text-xs text-slate-400">Spent: {formatCurrency(p.spent)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => setShowMembers(p)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {p.memberCount || 0} members
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {p.start_date ? formatDate(p.start_date) : '-'} — {p.planned_end ? formatDate(p.planned_end) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleViewStages(p)}
                        className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
                        Stages
                      </button>
                      {!isSelected && (
                        <button onClick={() => selectProject(p)}
                          className="text-xs text-slate-500 hover:text-blue-600 font-medium">
                          Select
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {showMembers && <ProjectMembersModal project={showMembers} onClose={() => setShowMembers(null)} />}

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refreshProjects(); }} />
      )}
    </div>
  );
}

const TEAM_ROLES = [
  { value: 'pm', label: 'Project Manager' },
  { value: 'engineer', label: 'Site Engineer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'procurement', label: 'Procurement Officer' },
  { value: 'accounts', label: 'Accounts Manager' },
  { value: 'inspector', label: 'Quality Inspector' },
];

const roleColors = {
  pm: 'bg-blue-100 text-blue-700',
  engineer: 'bg-green-100 text-green-700',
  contractor: 'bg-orange-100 text-orange-700',
  procurement: 'bg-teal-100 text-teal-700',
  accounts: 'bg-indigo-100 text-indigo-700',
  inspector: 'bg-red-100 text-red-700',
};

function CreateProjectModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', location: '', plot_size: '', start_date: '', planned_end: '', total_budget: '',
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [saving, setSaving] = useState(false);

  // Fetch team members when moving to step 2
  const goToStep2 = async () => {
    setLoadingTeam(true);
    try {
      const members = await api.get('/auth/team');
      setTeamMembers(members.filter(m => m.is_active));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTeam(false);
    }
    setStep(2);
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    goToStep2();
  };

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
      // Assign selected team members
      for (const a of assignments) {
        try {
          await api.post(`/projects/${project.id}/members`, { user_id: a.user_id, role: a.role });
        } catch (err) {
          console.error('Failed to assign member:', a.name, err);
        }
      }
      onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
                {/* Add member dropdown */}
                {availableMembers.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Add Member</label>
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) addAssignment(Number(e.target.value)); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
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

                {/* Assigned members list */}
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
                          <select
                            value={a.role}
                            onChange={(e) => updateAssignmentRole(a.user_id, e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
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
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Back
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={handleCreate} disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Creating...' : assignments.length > 0 ? `Create with ${assignments.length} Member${assignments.length > 1 ? 's' : ''}` : 'Skip & Create'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, isSelected, onSelect, onViewStages }) {
  return (
    <div className={`bg-white rounded-xl border p-6 transition-all ${isSelected ? 'border-blue-400 shadow-md ring-2 ring-blue-100' : 'border-slate-200 hover:shadow-md hover:border-blue-300'}`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-slate-800">{project.name}</h3>
        {isSelected && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
      </div>
      <p className="text-sm text-slate-500 mb-3">{project.location || 'No location'}</p>
      <ProgressBar value={project.completion} />
      <p className="text-xs text-slate-500 mt-1">{project.completion}% complete | {project.totalStages || 0} stages</p>
      <div className="flex items-center gap-2 mt-4">
        <button onClick={onViewStages}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
          View Stages
        </button>
        {!isSelected && (
          <button onClick={onSelect}
            className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 font-medium">
            Select
          </button>
        )}
      </div>
    </div>
  );
}
