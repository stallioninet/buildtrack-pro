import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import { ROLE_LABELS } from '../config/navigation';

const TEAM_ROLES = [
  { value: 'pm', label: 'Project Manager' },
  { value: 'engineer', label: 'Site Engineer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'procurement', label: 'Procurement Officer' },
  { value: 'accounts', label: 'Accounts Manager' },
  { value: 'inspector', label: 'Quality Inspector' },
];

function CreateMemberModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'engineer' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/team', form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Add Team Member</h3>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
            <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignToProjectModal({ member, projects, onClose, onAssigned }) {
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const assignedProjectIds = (member.projects || []).map(p => p.project_id);
  const availableProjects = projects.filter(p => !assignedProjectIds.includes(p.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/members`, { user_id: member.id, role });
      onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Assign to Project</h3>
        <p className="text-sm text-slate-500 mb-4">Assign <strong>{member.name}</strong> to a project</p>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select required value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">Select project...</option>
              {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role on Project</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving || !projectId} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const { projects } = useProject();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [assignMember, setAssignMember] = useState(null);

  const loadMembers = () => {
    setLoading(true);
    api.get('/auth/team').then(setMembers).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); }, []);

  if (user?.role !== 'owner') {
    return <div className="text-center py-12 text-slate-500">Only owners can manage team members.</div>;
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading team...</div>;

  const roleColors = {
    pm: 'bg-blue-100 text-blue-700',
    engineer: 'bg-green-100 text-green-700',
    contractor: 'bg-orange-100 text-orange-700',
    procurement: 'bg-teal-100 text-teal-700',
    accounts: 'bg-indigo-100 text-indigo-700',
    inspector: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">{members.length} team member{members.length !== 1 ? 's' : ''} under your account</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Projects</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      {m.avatarCode || m.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{m.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{m.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[m.role] || 'bg-slate-100 text-slate-600'}`}>
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {m.projects?.length > 0 ? m.projects.map(p => (
                      <span key={p.project_id} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                        {p.project_name}
                      </span>
                    )) : (
                      <span className="text-xs text-slate-400">Not assigned</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {m.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAssignMember(m)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Assign to Project
                    </button>
                    {m.is_active ? (
                      <button onClick={async () => {
                        await api.patch(`/auth/team/${m.id}`, { is_active: false });
                        loadMembers();
                      }} className="text-xs text-red-600 hover:text-red-800 font-medium">
                        Deactivate
                      </button>
                    ) : (
                      <button onClick={async () => {
                        await api.patch(`/auth/team/${m.id}`, { is_active: true });
                        loadMembers();
                      }} className="text-xs text-green-600 hover:text-green-800 font-medium">
                        Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                  No team members yet. Add your first team member to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateMemberModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadMembers(); }} />}
      {assignMember && <AssignToProjectModal member={assignMember} projects={projects} onClose={() => setAssignMember(null)} onAssigned={() => { setAssignMember(null); loadMembers(); }} />}
    </div>
  );
}
