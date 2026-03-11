import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import { formatDate } from '../utils/formatters';

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Ordered', 'Delivered', 'Cancelled'];

function MaterialModal({ material, stages, onClose, onSave }) {
  const [form, setForm] = useState({
    material: material?.material || '',
    quantity: material?.quantity || '',
    stage_id: material?.stage_id || '',
    requested_date: material?.requested_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        stage_id: form.stage_id ? Number(form.stage_id) : null,
      };
      if (material) {
        await api.patch(`/materials/${material.id}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      onSave();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          {material ? 'Edit Material Request' : 'New Material Request'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-medium">Material Name</label>
            <input
              type="text"
              name="material"
              value={form.material}
              onChange={handleChange}
              required
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Quantity</label>
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              required
              min="1"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Stage</label>
            <select
              name="stage_id"
              value={form.stage_id}
              onChange={handleChange}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
            >
              <option value="">-- Select Stage --</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Requested Date</label>
            <input
              type="date"
              name="requested_date"
              value={form.requested_date}
              onChange={handleChange}
              required
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : material ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MaterialsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const projectId = currentProject?.id;
  const role = user?.role;

  const [materials, setMaterials] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const canCreate = ['pm', 'engineer', 'contractor', 'procurement'].includes(role);
  const canDelete = ['owner', 'pm', 'procurement'].includes(role);

  const fetchMaterials = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.get(`/materials?project_id=${projectId}`);
      setMaterials(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchStages = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.get(`/stages?project_id=${projectId}`);
      setStages(data);
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchMaterials();
    fetchStages();
  }, [fetchMaterials, fetchStages]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/materials/${id}/status`, { status });
      fetchMaterials();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material request?')) return;
    try {
      await api.delete(`/materials/${id}`);
      fetchMaterials();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = () => {
    setModalOpen(false);
    setEditing(null);
    fetchMaterials();
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (mat) => {
    setEditing(mat);
    setModalOpen(true);
  };

  const filtered = filterStatus
    ? materials.filter((m) => m.status === filterStatus)
    : materials;

  if (!projectId) {
    return <div className="text-center py-12 text-slate-500">Select a project to view material requests.</div>;
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading materials...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Material Requests</h1>
        {canCreate && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + New Request
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500 font-medium">Filter by status:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2"
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Code</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Material</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Quantity</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Stage</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Requested By</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Date</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
              {canDelete && <th className="text-left py-3 px-4 text-slate-500 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr
                key={req.id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => openEdit(req)}
              >
                <td className="py-3 px-4 font-medium text-slate-700">{req.request_code}</td>
                <td className="py-3 px-4 text-slate-600">{req.material}</td>
                <td className="py-3 px-4 text-slate-600">{req.quantity}</td>
                <td className="py-3 px-4 text-slate-600">{req.stage_name || '-'}</td>
                <td className="py-3 px-4 text-slate-600">{req.requested_by_name || '-'}</td>
                <td className="py-3 px-4 text-slate-600">{formatDate(req.requested_date)}</td>
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={req.status}
                    onChange={(e) => handleStatusChange(req.id, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                {canDelete && (
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400">No material requests found</div>
        )}
      </div>

      {modalOpen && (
        <MaterialModal
          material={editing}
          stages={stages}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
