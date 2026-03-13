import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import { showError, showWarning } from '../utils/toast';
import CommentsSection from '../components/shared/CommentsSection';
import {
  PERMIT_TYPES, PERMIT_STATUSES, RISK_LEVELS,
  INCIDENT_TYPES, INCIDENT_SEVERITIES, INCIDENT_STATUSES,
  PERMIT_STATUS_COLORS, INCIDENT_STATUS_COLORS, RISK_COLORS,
  INCIDENT_SEVERITY_COLORS as SEVERITY_COLORS,
} from '../config/constants';
import { useModal } from '../hooks/useModal';

export default function SafetyPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('permits');
  const [summary, setSummary] = useState(null);
  const [permits, setPermits] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permitFilter, setPermitFilter] = useState({ status: '' });
  const [incidentFilter, setIncidentFilter] = useState({ status: '' });
  const modal = useModal();
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);

  const canCreate = ['owner', 'pm', 'engineer', 'inspector', 'contractor'].includes(user?.role);
  const canDelete = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    const permitStatusParam = permitFilter.status ? `&status=${permitFilter.status}` : '';
    const incidentStatusParam = incidentFilter.status ? `&status=${incidentFilter.status}` : '';
    Promise.all([
      api.get(`/safety/summary?project_id=${pid}`),
      api.get(`/safety/permits?project_id=${pid}${permitStatusParam}`),
      api.get(`/safety/incidents?project_id=${pid}${incidentStatusParam}`),
    ]).then(([summaryData, permitsData, incidentsData]) => {
      setSummary(summaryData);
      setPermits(permitsData);
      setIncidents(incidentsData);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, permitFilter, incidentFilter]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
    api.get('/auth/users').then(setUsers).catch(() => setUsers([]));
  }, [currentProject?.id]);

  const handlePermitStatusChange = async (permit, newStatus) => {
    try {
      await api.patch(`/safety/permits/${permit.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  const handleIncidentStatusChange = async (incident, newStatus) => {
    try {
      await api.patch(`/safety/incidents/${incident.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  const handleDeletePermit = async (permit) => {
    if (!confirm(`Delete permit ${permit.permit_code}?`)) return;
    try {
      await api.delete(`/safety/permits/${permit.id}`);
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to delete');
    }
  };

  const handleDeleteIncident = async (incident) => {
    if (!confirm(`Delete incident ${incident.incident_code}?`)) return;
    try {
      await api.delete(`/safety/incidents/${incident.id}`);
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to delete');
    }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Safety Management</h1>
          <p className="text-sm text-slate-500 mt-1">Permits to Work (PTW) and Incident tracking</p>
        </div>
        {canCreate && (
          <button onClick={() => {
            if (activeTab === 'permits') modal.open('permit');
            else modal.open('incident');
          }}
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">
            + New {activeTab === 'permits' ? 'Permit' : 'Incident'}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Permits" value={summary.permits?.total || 0} color="blue" />
          <StatCard label="Active Permits" value={summary.permits?.active || 0} color="green" />
          <StatCard label="Total Incidents" value={summary.incidents?.total || 0} color="orange" />
          <StatCard label="Open Incidents" value={summary.incidents?.open || 0} color="red" />
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('permits')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'permits'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Permits (PTW)
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'incidents'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Incidents
        </button>
      </div>

      {/* Permits Tab */}
      {activeTab === 'permits' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={permitFilter.status} onChange={e => setPermitFilter(f => ({ ...f, status: e.target.value }))}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
              <option value="">All Statuses</option>
              {PERMIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Permit List */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading permits...</div>
          ) : permits.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No permits found</div>
          ) : (
            <div className="space-y-3">
              {permits.map(permit => (
                <div key={permit.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-slate-400">{permit.permit_code}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${RISK_COLORS[permit.risk_level] || ''}`}>
                          {permit.risk_level}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PERMIT_STATUS_COLORS[permit.status] || 'bg-slate-100 text-slate-600'}`}>
                          {permit.status}
                        </span>
                        <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">{permit.permit_type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                        onClick={() => modal.open('permit', permit)}>
                        {permit.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                        {permit.stage_name && <span>{permit.stage_name}</span>}
                        {permit.location && <span>@ {permit.location}</span>}
                        {permit.requested_by_name && <span>By: {permit.requested_by_name}</span>}
                        {permit.approved_by_name && <span className="text-green-600">Approved: {permit.approved_by_name}</span>}
                        {permit.valid_from && <span>From: {formatDate(permit.valid_from)}</span>}
                        {permit.valid_to && <span>To: {formatDate(permit.valid_to)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {permit.status !== 'Closed' && permit.status !== 'Expired' && (
                        <select
                          value={permit.status}
                          onChange={e => handlePermitStatusChange(permit, e.target.value)}
                          className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white"
                        >
                          {PERMIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDeletePermit(permit)}
                          className="text-[10px] text-red-400 hover:text-red-600">Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={incidentFilter.status} onChange={e => setIncidentFilter(f => ({ ...f, status: e.target.value }))}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
              <option value="">All Statuses</option>
              {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Incident List */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading incidents...</div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No incidents found</div>
          ) : (
            <div className="space-y-3">
              {incidents.map(incident => (
                <div key={incident.id} className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow ${
                  incident.severity === 'fatal' ? 'border-red-300' : incident.severity === 'serious' ? 'border-red-200' : 'border-slate-200'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-slate-400">{incident.incident_code}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${SEVERITY_COLORS[incident.severity] || ''}`}>
                          {incident.severity}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${INCIDENT_STATUS_COLORS[incident.status] || 'bg-slate-100 text-slate-600'}`}>
                          {incident.status}
                        </span>
                        <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">{incident.incident_type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                        onClick={() => modal.open('incident', incident)}>
                        {incident.title}
                      </h3>
                      {incident.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{incident.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                        {incident.stage_name && <span>{incident.stage_name}</span>}
                        {incident.location && <span>@ {incident.location}</span>}
                        {incident.incident_date && <span>Date: {formatDate(incident.incident_date)}</span>}
                        {incident.incident_time && <span>Time: {incident.incident_time}</span>}
                        {incident.reported_by_name && <span>Reported by: {incident.reported_by_name}</span>}
                        {incident.investigated_by_name && <span className="text-blue-500">Investigator: {incident.investigated_by_name}</span>}
                      </div>
                      {incident.corrective_action && (
                        <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-green-600 font-medium mb-0.5">Corrective Action</p>
                          <p className="text-xs text-green-800 line-clamp-2">{incident.corrective_action}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {incident.status !== 'Closed' && (
                        <select
                          value={incident.status}
                          onChange={e => handleIncidentStatusChange(incident, e.target.value)}
                          className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white"
                        >
                          {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDeleteIncident(incident)}
                          className="text-[10px] text-red-400 hover:text-red-600">Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Permit Modal */}
      {modal.isOpen('permit') && (
        <PermitModal
          permit={modal.data('permit')}
          projectId={currentProject.id}
          stages={stages}
          onClose={() => modal.close('permit')}
          onSaved={() => { modal.close('permit'); loadData(); }}
        />
      )}

      {/* Incident Modal */}
      {modal.isOpen('incident') && (
        <IncidentModal
          incident={modal.data('incident')}
          projectId={currentProject.id}
          stages={stages}
          users={users}
          onClose={() => modal.close('incident')}
          onSaved={() => { modal.close('incident'); loadData(); }}
        />
      )}
    </div>
  );
}

function PermitModal({ permit, projectId, stages, onClose, onSaved }) {
  const isEdit = !!permit;
  const [form, setForm] = useState({
    title: permit?.title || '',
    permit_type: permit?.permit_type || 'General',
    description: permit?.description || '',
    stage_id: permit?.stage_id || '',
    location: permit?.location || '',
    risk_level: permit?.risk_level || 'medium',
    precautions: permit?.precautions || '',
    valid_from: permit?.valid_from || '',
    valid_to: permit?.valid_to || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return showWarning('Title is required');
    if (!form.permit_type) return showWarning('Permit type is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/safety/permits/${permit.id}`, form);
      } else {
        await api.post('/safety/permits', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save permit');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${permit.permit_code} — Edit Permit` : 'New Permit to Work'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Brief description of the work requiring a permit" />
          </div>

          {/* Row: Type + Risk Level + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Permit Type *</label>
              <select value={form.permit_type} onChange={e => set('permit_type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {PERMIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Risk Level</label>
              <select value={form.risk_level} onChange={e => set('risk_level', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {RISK_LEVELS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Stage</label>
              <select value={form.stage_id} onChange={e => set('stage_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Detailed scope of work and hazards involved" />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Location</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="e.g., Basement Level 2, Grid A3-B5" />
          </div>

          {/* Precautions */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Safety Precautions</label>
            <textarea value={form.precautions} onChange={e => set('precautions', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="List all safety precautions, PPE requirements, and control measures" />
          </div>

          {/* Valid From / To */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Valid From</label>
              <input type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Valid To</label>
              <input type="date" value={form.valid_to} onChange={e => set('valid_to', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>

          {isEdit && <CommentsSection entityType="safety_permit" entityId={permit.id} />}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Permit' : 'Create Permit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IncidentModal({ incident, projectId, stages, users, onClose, onSaved }) {
  const isEdit = !!incident;
  const [form, setForm] = useState({
    title: incident?.title || '',
    incident_type: incident?.incident_type || 'Near Miss',
    severity: incident?.severity || 'minor',
    description: incident?.description || '',
    stage_id: incident?.stage_id || '',
    location: incident?.location || '',
    incident_date: incident?.incident_date || '',
    incident_time: incident?.incident_time || '',
    persons_involved: incident?.persons_involved || '',
    injuries: incident?.injuries || '',
    root_cause: incident?.root_cause || '',
    corrective_action: incident?.corrective_action || '',
    preventive_action: incident?.preventive_action || '',
    investigated_by: incident?.investigated_by || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return showWarning('Title is required');
    if (!form.incident_type) return showWarning('Incident type is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/safety/incidents/${incident.id}`, form);
      } else {
        await api.post('/safety/incidents', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save incident');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${incident.incident_code} — Edit Incident` : 'Report New Incident'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Brief description of the incident" />
          </div>

          {/* Row: Type + Severity + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Incident Type *</label>
              <select value={form.incident_type} onChange={e => set('incident_type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Severity</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {INCIDENT_SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Stage</label>
              <select value={form.stage_id} onChange={e => set('stage_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Detailed account of what happened, conditions, and sequence of events" />
          </div>

          {/* Row: Location + Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Location</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="e.g., Tower B, 5th Floor" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Incident Date</label>
              <input type="date" value={form.incident_date} onChange={e => set('incident_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Incident Time</label>
              <input type="time" value={form.incident_time} onChange={e => set('incident_time', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>

          {/* Row: Persons Involved + Injuries */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Persons Involved</label>
              <input type="text" value={form.persons_involved} onChange={e => set('persons_involved', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="Names or count of persons involved" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Injuries</label>
              <input type="text" value={form.injuries} onChange={e => set('injuries', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="Nature and extent of injuries, if any" />
            </div>
          </div>

          {/* Investigation Section (shown on edit) */}
          {isEdit && (
            <div className="border-t pt-4 mt-4 space-y-4">
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Investigation & Actions</h4>

              <div>
                <label className="text-xs text-slate-500 font-medium">Investigator</label>
                <select value={form.investigated_by} onChange={e => set('investigated_by', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                  <option value="">Select investigator</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Root Cause</label>
                <textarea value={form.root_cause} onChange={e => set('root_cause', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Identified root cause of the incident" />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Corrective Action</label>
                <textarea value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Immediate corrective actions taken or planned" />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Preventive Action</label>
                <textarea value={form.preventive_action} onChange={e => set('preventive_action', e.target.value)}
                  rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                  placeholder="Long-term preventive measures to avoid recurrence" />
              </div>
            </div>
          )}

          {isEdit && <CommentsSection entityType="safety_incident" entityId={incident.id} />}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Incident' : 'Report Incident'}
          </button>
        </div>
      </div>
    </div>
  );
}
