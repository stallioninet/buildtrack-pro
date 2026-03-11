import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import { formatDate } from '../utils/formatters';

const INSPECTION_TYPES = ['General', 'Foundation Check', 'Soil Bearing', 'Concrete Cube Test', 'Rebar Inspection', 'Formwork Check', 'Concrete Pour', 'Safety Audit', 'Brick Quality', 'Waterproofing', 'Structural Alignment', 'Electrical', 'Plumbing', 'Fire Safety', 'Final Handover'];
const INSPECTION_STATUSES = ['Scheduled', 'In Progress', 'Completed'];
const INSPECTION_RESULTS = ['Pass', 'Conditional', 'Fail'];
const DEFECT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const DEFECT_CATEGORIES = ['Structural', 'Workmanship', 'Material', 'Safety', 'Waterproofing', 'Electrical', 'Plumbing', 'Finishing'];
const DEFECT_STATUSES = ['Open', 'In Progress', 'Resolved'];

const INSPECTION_CATEGORIES = [
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'witness_point', label: 'Witness Point' },
  { value: 'surveillance', label: 'Surveillance' },
];

const SEVERITY_COLORS = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-slate-100 text-slate-600',
};

const STATUS_DOTS = {
  Open: 'bg-red-500',
  'In Progress': 'bg-amber-500',
  Resolved: 'bg-green-500',
  Scheduled: 'bg-blue-500',
  Completed: 'bg-green-500',
};

export default function QualityPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [tab, setTab] = useState('inspections');
  const [summary, setSummary] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [defects, setDefects] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [inspStatusFilter, setInspStatusFilter] = useState('');
  const [inspTypeFilter, setInspTypeFilter] = useState('');
  const [defStatusFilter, setDefStatusFilter] = useState('');
  const [defSeverityFilter, setDefSeverityFilter] = useState('');

  // Modals
  const [inspModal, setInspModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', data: inspection } | { mode: 'view', data: inspection }
  const [defectModal, setDefectModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', data: defect }

  const projectId = currentProject?.id;
  const canCreate = ['pm', 'engineer', 'inspector'].includes(user?.role);
  const canEdit = ['pm', 'engineer', 'inspector'].includes(user?.role);
  const canDelete = ['pm', 'inspector'].includes(user?.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const q = projectId ? `?project_id=${projectId}` : '';
      const [summ, insps, defs] = await Promise.all([
        api.get(`/inspections/summary${q}`),
        api.get(`/inspections${q}`),
        api.get(`/inspections/defects/all${q}`),
      ]);
      setSummary(summ);
      setInspections(insps);
      setDefects(defs);

      if (projectId) {
        const stgs = await api.get(`/stages?project_id=${projectId}`).catch(() => []);
        setStages(Array.isArray(stgs) ? stgs : stgs.stages || []);
      }
      const usrs = await api.get('/auth/users').catch(() => []);
      setUsers(usrs);
    } catch (err) {
      console.error('Failed to load quality data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteInspection = async (insp) => {
    if (!confirm(`Delete inspection ${insp.inspection_code}? This will also remove linked defects.`)) return;
    try {
      await api.delete(`/inspections/${insp.id}`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredInspections = inspections.filter(i => {
    if (inspStatusFilter && i.status !== inspStatusFilter) return false;
    if (inspTypeFilter && i.type !== inspTypeFilter) return false;
    return true;
  });

  const filteredDefects = defects.filter(d => {
    if (defStatusFilter && d.status !== defStatusFilter) return false;
    if (defSeverityFilter && d.severity !== defSeverityFilter) return false;
    return true;
  });

  if (!projectId) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="text-lg font-semibold text-slate-700 mb-1">Select a Project</h2>
        <p className="text-sm text-slate-400">Choose a project from the top bar to view quality & inspections</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const is = summary?.inspections || {};
  const ds = summary?.defects || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quality & Inspections</h1>
          <p className="text-sm text-slate-500 mt-1">{currentProject?.name}</p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <button onClick={() => setDefectModal({ mode: 'create' })} className="px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50">
              + Log Defect
            </button>
            <button onClick={() => setInspModal({ mode: 'create' })} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
              + Schedule Inspection
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Inspections" value={is.total || 0} color="blue" />
        <StatCard label="Scheduled" value={is.scheduled || 0} color="purple" />
        <StatCard label="Pass Rate" value={`${is.passRate || 0}%`} color="green" />
        <StatCard label="Open Defects" value={ds.open || 0} color="red" />
        <StatCard label="In Progress" value={ds.inProgress || 0} color="orange" />
        <StatCard label="High Severity" value={ds.highSeverity || 0} color="red" />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {[
            { key: 'inspections', label: 'Inspections', count: inspections.length },
            { key: 'defects', label: 'Defects', count: defects.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label} <span className="text-xs text-slate-400 ml-1">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inspections Tab */}
      {tab === 'inspections' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select value={inspStatusFilter} onChange={e => setInspStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600">
              <option value="">All Statuses</option>
              {INSPECTION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={inspTypeFilter} onChange={e => setInspTypeFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600">
              <option value="">All Types</option>
              {INSPECTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {(inspStatusFilter || inspTypeFilter) && (
              <button onClick={() => { setInspStatusFilter(''); setInspTypeFilter(''); }}
                className="text-xs text-blue-600 hover:text-blue-800">Clear</button>
            )}
            <span className="text-xs text-slate-400 ml-auto">{filteredInspections.length} results</span>
          </div>

          {/* Inspection table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Code</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Category</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Stage</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Inspector</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Result</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Defects</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map(insp => (
                  <tr key={insp.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-500">{insp.inspection_code}</span>
                      {insp.standard_ref && (
                        <div className="mt-0.5">
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{insp.standard_ref}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{insp.type || 'General'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        insp.category === 'hold_point' ? 'bg-red-50 text-red-700' :
                        insp.category === 'witness_point' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-50 text-slate-600'
                      }`}>{
                        insp.category === 'hold_point' ? 'Hold Point' :
                        insp.category === 'witness_point' ? 'Witness Point' :
                        'Surveillance'
                      }</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {insp.stage_name || '-'}
                      {insp.location && <div className="text-slate-400">@ {insp.location}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{formatDate(insp.inspection_date)}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{insp.inspector_name || '-'}</td>
                    <td className="py-3 px-4">
                      {insp.result ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          insp.result === 'Pass' ? 'bg-green-100 text-green-700' :
                          insp.result === 'Fail' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{insp.result}</span>
                      ) : <span className="text-xs text-slate-400">-</span>}
                    </td>
                    <td className="py-3 px-4">
                      {insp.defect_count > 0 ? (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">{insp.defect_count}</span>
                      ) : <span className="text-xs text-slate-400">0</span>}
                    </td>
                    <td className="py-3 px-4"><Badge status={insp.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setInspModal({ mode: 'view', data: insp })}
                          title="View details" className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {canEdit && (
                          <button onClick={() => setInspModal({ mode: 'edit', data: insp })}
                            title="Edit" className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDeleteInspection(insp)}
                            title="Delete" className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredInspections.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                {inspections.length === 0 ? 'No inspections yet. Click "+ Schedule Inspection" to create one.' : 'No inspections match filters'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Defects Tab */}
      {tab === 'defects' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select value={defStatusFilter} onChange={e => setDefStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600">
              <option value="">All Statuses</option>
              {DEFECT_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={defSeverityFilter} onChange={e => setDefSeverityFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600">
              <option value="">All Severities</option>
              {DEFECT_SEVERITIES.map(s => <option key={s}>{s}</option>)}
            </select>
            {(defStatusFilter || defSeverityFilter) && (
              <button onClick={() => { setDefStatusFilter(''); setDefSeverityFilter(''); }}
                className="text-xs text-blue-600 hover:text-blue-800">Clear</button>
            )}
            <span className="text-xs text-slate-400 ml-auto">{filteredDefects.length} results</span>
          </div>

          {/* Defect cards */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Defect</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Severity</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Category</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Location</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Assigned</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Due</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDefects.map(defect => (
                  <tr key={defect.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-slate-400 block">{defect.defect_code}</span>
                      <span className="text-slate-700 text-xs">{defect.description.length > 80 ? defect.description.slice(0, 80) + '...' : defect.description}</span>
                      {defect.inspection_code && <span className="text-[10px] text-slate-400 block">Insp: {defect.inspection_code}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[defect.severity] || ''}`}>{defect.severity}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{defect.category || '-'}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{defect.location || '-'}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{defect.assigned_to || '-'}</td>
                    <td className="py-3 px-4">
                      {defect.due_date ? (
                        <span className={`text-xs ${new Date(defect.due_date) < new Date() && defect.status !== 'Resolved' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                          {formatDate(defect.due_date)}
                        </span>
                      ) : <span className="text-xs text-slate-400">-</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[defect.status] || 'bg-slate-300'}`} />
                        <span className="text-xs">{defect.status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button onClick={() => setDefectModal({ mode: 'edit', data: defect })}
                            title="Edit" className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDefects.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                {defects.length === 0 ? 'No defects recorded. Click "+ Log Defect" to create one.' : 'No defects match filters'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspection Create/Edit/View Modal */}
      {inspModal && (
        <InspectionModal
          mode={inspModal.mode}
          inspection={inspModal.data || null}
          projectId={projectId}
          stages={stages}
          users={users}
          canEdit={canEdit}
          onClose={() => setInspModal(null)}
          onSaved={() => { setInspModal(null); loadData(); }}
        />
      )}

      {/* Defect Create/Edit Modal */}
      {defectModal && (
        <DefectModal
          mode={defectModal.mode}
          defect={defectModal.data || null}
          projectId={projectId}
          inspections={inspections}
          onClose={() => setDefectModal(null)}
          onSaved={() => { setDefectModal(null); loadData(); }}
        />
      )}
    </div>
  );
}

// ==================== INSPECTION MODAL (Create / Edit / View) ====================

function InspectionModal({ mode, inspection, projectId, stages, users, canEdit, onClose, onSaved }) {
  const isCreate = mode === 'create';
  const isView = mode === 'view';
  const isEdit = mode === 'edit';

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(!isCreate);
  const [showLinkTask, setShowLinkTask] = useState(false);

  const [form, setForm] = useState({
    type: inspection?.type || 'General',
    category: inspection?.category || 'hold_point',
    inspection_date: inspection?.inspection_date || new Date().toISOString().split('T')[0],
    stage_id: inspection?.stage_id || '',
    inspector_id: inspection?.inspector_id || '',
    location: inspection?.location || '',
    standard_ref: inspection?.standard_ref || '',
    notes: inspection?.notes || '',
    status: inspection?.status || 'Scheduled',
    result: inspection?.result || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = () => {
    if (!inspection?.id) return;
    return api.get(`/inspections/${inspection.id}`).then(d => {
      setDetail(d);
      setForm(f => ({
        ...f,
        type: d.type || f.type,
        category: d.category || f.category,
        inspection_date: d.inspection_date || f.inspection_date,
        stage_id: d.stage_id || '',
        inspector_id: d.inspector_id || '',
        location: d.location || '',
        standard_ref: d.standard_ref || '',
        notes: d.notes || '',
        status: d.status || f.status,
        result: d.result || '',
      }));
    });
  };

  useEffect(() => {
    if (!isCreate && inspection?.id) {
      loadDetail().catch(console.error).finally(() => setLoadingDetail(false));
    }
  }, [isCreate, inspection?.id]);

  const handleUnlinkTask = async (taskId, linkId) => {
    if (!confirm('Remove this task link?')) return;
    try {
      await api.delete(`/tasks/${taskId}/inspections/${linkId}`);
      loadDetail();
    } catch (err) {
      alert(err.message || 'Failed to unlink');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isCreate) {
        await api.post('/inspections', {
          project_id: projectId,
          ...form,
          category: form.category,
          stage_id: form.stage_id || null,
          inspector_id: form.inspector_id || null,
          result: form.result || null,
        });
      } else {
        await api.patch(`/inspections/${inspection.id}`, {
          ...form,
          category: form.category,
          stage_id: form.stage_id || null,
          inspector_id: form.inspector_id || null,
          result: form.result || null,
        });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const up = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const title = isCreate ? 'Schedule Inspection' : isEdit ? `Edit ${inspection?.inspection_code}` : inspection?.inspection_code;
  const editable = isCreate || isEdit;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            {!isCreate && <p className="text-xs text-slate-400">{inspection?.type} · {formatDate(inspection?.inspection_date)}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isView && canEdit && (
              <button onClick={() => setForm(f => f) /* keep form */ }
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                // We can't change mode easily, so direct user to click Edit button on row
              >
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {loadingDetail ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Row 1: Type + Category + Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                {editable ? (
                  <select value={form.type} onChange={e => up('type', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                    {INSPECTION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 py-2">{form.type}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                {editable ? (
                  <select value={form.category} onChange={e => up('category', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                    {INSPECTION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 py-2">{INSPECTION_CATEGORIES.find(c => c.value === form.category)?.label || form.category}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                {editable ? (
                  <input type="date" value={form.inspection_date} onChange={e => up('inspection_date', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" required />
                ) : (
                  <p className="text-sm text-slate-700 py-2">{formatDate(form.inspection_date)}</p>
                )}
              </div>
            </div>

            {/* Row 2: Stage + Inspector */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
                {editable ? (
                  <select value={form.stage_id} onChange={e => up('stage_id', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                    <option value="">Select stage</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 py-2">{inspection?.stage_name || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Inspector</label>
                {editable ? (
                  <select value={form.inspector_id} onChange={e => up('inspector_id', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                    <option value="">Select inspector</option>
                    {users.filter(u => u.role === 'inspector' || u.role === 'engineer').map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.roleDisplayName})</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 py-2">{inspection?.inspector_name || '-'}</p>
                )}
              </div>
            </div>

            {/* Row 3: Status + Result (edit/view only) */}
            {!isCreate && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  {editable ? (
                    <select value={form.status} onChange={e => up('status', e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                      {INSPECTION_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div className="py-2"><Badge status={form.status} /></div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Result</label>
                  {editable ? (
                    <select value={form.result} onChange={e => up('result', e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                      <option value="">Not yet determined</option>
                      {INSPECTION_RESULTS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm py-2">
                      {form.result ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          form.result === 'Pass' ? 'bg-green-100 text-green-700' :
                          form.result === 'Fail' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{form.result}</span>
                      ) : <span className="text-slate-400">-</span>}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Row 4: Location */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
              {editable ? (
                <input type="text" value={form.location} onChange={e => up('location', e.target.value)}
                  placeholder="e.g., Block A - 2nd Floor" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              ) : (
                <p className="text-sm text-slate-700 py-2">{form.location || '-'}</p>
              )}
            </div>

            {/* Row 5: Standard Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Standard Reference</label>
              {editable ? (
                <input type="text" value={form.standard_ref} onChange={e => up('standard_ref', e.target.value)}
                  placeholder="e.g., IS 456:2000" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              ) : (
                <p className="text-sm py-2">{form.standard_ref ? <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{form.standard_ref}</span> : <span className="text-slate-400">-</span>}</p>
              )}
            </div>

            {/* Row 6: Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              {editable ? (
                <textarea value={form.notes} onChange={e => up('notes', e.target.value)}
                  rows={3} placeholder="Inspection notes, observations..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              ) : (
                <p className="text-sm text-slate-700 py-2 whitespace-pre-wrap">{form.notes || '-'}</p>
              )}
            </div>

            {/* Linked defects (view/edit) */}
            {!isCreate && detail?.defects?.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Linked Defects ({detail.defects.length})</h4>
                <div className="space-y-2">
                  {detail.defects.map(d => (
                    <div key={d.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">{d.defect_code}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[d.severity] || ''}`}>{d.severity}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[d.status] || 'bg-slate-300'}`} />
                        <span className="text-xs text-slate-500">{d.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{d.description}</p>
                      {d.location && <p className="text-[11px] text-slate-400 mt-0.5">@ {d.location}</p>}
                      {d.resolution_notes && (
                        <p className="text-[11px] text-green-600 mt-1 bg-green-50 px-2 py-1 rounded">Resolved: {d.resolution_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Tasks */}
            {!isCreate && (
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Linked Tasks {detail?.linkedTasks?.length > 0 && `(${detail.linkedTasks.length})`}
                  </h4>
                  {canEdit && (
                    <button type="button" onClick={() => setShowLinkTask(true)}
                      className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 font-medium">
                      + Link Task
                    </button>
                  )}
                </div>
                {detail?.linkedTasks?.length > 0 ? (
                  <div className="space-y-2">
                    {detail.linkedTasks.map(t => (
                      <div key={t.link_id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            t.link_type === 'required' ? 'bg-red-100 text-red-700' :
                            t.link_type === 'blocked_by' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{t.link_type === 'blocked_by' ? 'blocked by' : t.link_type}</span>
                          <span className="text-xs font-mono text-slate-400">{t.task_code}</span>
                          <span className="text-xs text-slate-700 truncate">{t.title}</span>
                          {t.parent_task_id && <span className="text-[10px] text-slate-400">(subtask)</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {t.stage_name && <span className="text-[10px] text-slate-400">{t.stage_name}</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            t.status === 'completed' ? 'bg-green-100 text-green-700' :
                            t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            t.status === 'not_started' ? 'bg-slate-100 text-slate-600' :
                            t.status === 'ready_for_inspection' ? 'bg-purple-100 text-purple-700' :
                            t.status === 'rework' ? 'bg-red-100 text-red-700' :
                            t.status === 'on_hold' ? 'bg-orange-100 text-orange-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{t.status}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                            t.priority === 'high' ? 'bg-red-50 text-red-600' :
                            t.priority === 'low' ? 'bg-slate-50 text-slate-500' :
                            'bg-yellow-50 text-yellow-600'
                          }`}>{t.priority}</span>
                          {canEdit && (
                            <button type="button" onClick={() => handleUnlinkTask(t.task_id, t.link_id)}
                              title="Unlink task" className="p-0.5 text-slate-400 hover:text-red-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No tasks linked to this inspection</p>
                )}
              </div>
            )}

            {/* Link Task Modal (overlay within inspection modal) */}
            {showLinkTask && !isCreate && (
              <LinkTaskPanel
                inspectionId={inspection.id}
                projectId={projectId}
                existingTaskIds={(detail?.linkedTasks || []).map(t => t.task_id)}
                onLinked={() => { setShowLinkTask(false); loadDetail(); }}
                onClose={() => setShowLinkTask(false)}
              />
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                {isView ? 'Close' : 'Cancel'}
              </button>
              {editable && (
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : isCreate ? 'Schedule Inspection' : 'Save Changes'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ==================== DEFECT MODAL (Create / Edit) ====================

function DefectModal({ mode, defect, projectId, inspections, onClose, onSaved }) {
  const isCreate = mode === 'create';

  const [form, setForm] = useState({
    description: defect?.description || '',
    severity: defect?.severity || 'Medium',
    category: defect?.category || 'Workmanship',
    inspection_id: defect?.inspection_id || '',
    location: defect?.location || '',
    assigned_to: defect?.assigned_to || '',
    due_date: defect?.due_date || '',
    status: defect?.status || 'Open',
    resolution_notes: defect?.resolution_notes || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const up = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isCreate) {
        await api.post('/inspections/defects', {
          project_id: projectId,
          ...form,
          inspection_id: form.inspection_id || null,
          resolution_notes: null,
        });
      } else {
        await api.patch(`/inspections/defects/${defect.id}`, {
          ...form,
          resolution_notes: form.resolution_notes || null,
        });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{isCreate ? 'Log Defect' : `Edit ${defect?.defect_code}`}</h3>
            {!isCreate && defect?.category && <p className="text-xs text-slate-400">{defect.category} · {defect.location || 'No location'}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => up('description', e.target.value)}
              rows={3} placeholder="Describe the defect..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Severity</label>
              <select value={form.severity} onChange={e => up('severity', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                {DEFECT_SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select value={form.category} onChange={e => up('category', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                {DEFECT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {!isCreate && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status} onChange={e => up('status', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                  {DEFECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Linked Inspection</label>
            <select value={form.inspection_id} onChange={e => up('inspection_id', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
              <option value="">No linked inspection</option>
              {inspections.map(i => <option key={i.id} value={i.id}>{i.inspection_code} - {i.type}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
              <input type="text" value={form.location} onChange={e => up('location', e.target.value)}
                placeholder="e.g., Column C3 - 1st Floor" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => up('due_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
            <input type="text" value={form.assigned_to} onChange={e => up('assigned_to', e.target.value)}
              placeholder="Contractor / Team name" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
          </div>

          {/* Resolution notes (edit mode, when status is Resolved) */}
          {!isCreate && (form.status === 'Resolved' || defect?.status === 'Resolved') && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Resolution Notes</label>
              <textarea value={form.resolution_notes} onChange={e => up('resolution_notes', e.target.value)}
                rows={3} placeholder="Describe how the defect was resolved..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
            </div>
          )}

          {/* Resolved info */}
          {defect?.resolved_by_name && (
            <div className="bg-green-50 px-3 py-2 rounded-lg text-xs text-green-700">
              Resolved by {defect.resolved_by_name} on {formatDate(defect.resolved_at)}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={submitting}
              className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${isCreate ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {submitting ? 'Saving...' : isCreate ? 'Log Defect' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== LINK TASK PANEL (inside InspectionModal) ====================

function LinkTaskPanel({ inspectionId, projectId, existingTaskIds, onLinked, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linkType, setLinkType] = useState('related');
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/tasks?project_id=${projectId}&flat=1`)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const linkedSet = new Set(existingTaskIds || []);

  const available = tasks.filter(t => {
    if (linkedSet.has(t.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.task_code || '').toLowerCase().includes(q) ||
      (t.title || '').toLowerCase().includes(q) ||
      (t.stage_name || '').toLowerCase().includes(q) ||
      (t.assigned_to_name || '').toLowerCase().includes(q)
    );
  });

  const handleLink = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post(`/tasks/${selected}/inspections`, {
        inspection_id: inspectionId,
        link_type: linkType,
      });
      onLinked();
    } catch (err) {
      alert(err.message || 'Failed to link task');
    } finally {
      setSubmitting(false);
    }
  };

  const PRIORITY_COLORS = {
    high: 'bg-red-50 text-red-600',
    medium: 'bg-yellow-50 text-yellow-600',
    low: 'bg-slate-50 text-slate-500',
  };

  return (
    <div className="border-t border-indigo-200 bg-indigo-50/40 rounded-b-lg -mx-5 -mb-4 mt-4">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-indigo-800">Link a Task to this Inspection</h4>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        {/* Link type selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Link type:</span>
          {['related', 'required', 'blocked_by'].map(lt => (
            <button key={lt} type="button" onClick={() => setLinkType(lt)}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                linkType === lt
                  ? (lt === 'required' ? 'bg-red-100 text-red-700' : lt === 'blocked_by' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')
                  : 'bg-white text-slate-500 hover:bg-slate-100'
              }`}>
              {lt === 'blocked_by' ? 'blocked by' : lt}
            </button>
          ))}
        </div>

        {/* Search */}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks by code, title, stage, assignee..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3" />

        {/* Task list */}
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {loading ? (
            <div className="text-center py-6 text-slate-400 text-sm">Loading tasks...</div>
          ) : available.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              {tasks.length === 0 ? 'No tasks in this project' : 'No unlinked tasks match your search'}
            </div>
          ) : (
            available.map(task => (
              <button key={task.id} type="button" onClick={() => setSelected(task.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  selected === task.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">{task.task_code}</span>
                  <span className="text-xs text-slate-700 truncate flex-1">{task.title}</span>
                  {task.parent_task_id && <span className="text-[10px] text-slate-400">(sub)</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>
                    {task.priority}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-700' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    task.status === 'not_started' ? 'bg-slate-100 text-slate-600' :
                    task.status === 'ready_for_inspection' ? 'bg-purple-100 text-purple-700' :
                    task.status === 'rework' ? 'bg-red-100 text-red-700' :
                    task.status === 'on_hold' ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{task.status}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  {task.stage_name && <span>{task.stage_name}</span>}
                  {task.assigned_to_name && <span>{task.assigned_to_name}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-indigo-100">
          <p className="text-xs text-slate-400">{available.length} available</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-white rounded-lg">Cancel</button>
            <button type="button" onClick={handleLink} disabled={!selected || submitting}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Linking...' : 'Link Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
