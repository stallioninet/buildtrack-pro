import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import ProgressBar from '../components/ui/ProgressBar';

export default function InventoryPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const canCreate = ['owner', 'pm', 'procurement', 'engineer'].includes(user?.role);
  const canDelete = ['owner', 'pm', 'procurement'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    api.get(`/inventory?project_id=${currentProject.id}`)
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this inventory item?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      loadData();
    } catch (err) { alert(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        {canCreate && (
          <button onClick={() => { setSelectedItem(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + Add Item
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No inventory items found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const usedPercent = item.total_inward > 0 ? Math.round((item.consumed / item.total_inward) * 100) : 0;
            const lowStock = item.stock <= item.total_inward * 0.2 && item.total_inward > 0;
            return (
              <div key={item.id} className={`bg-white rounded-xl border p-5 ${lowStock ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{item.material}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Unit: {item.unit}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setSelectedItem(item); setShowModal(true); }}
                      className="text-slate-400 hover:text-blue-600 p-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDelete(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                {lowStock && (
                  <span className="inline-block text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium mb-2">LOW STOCK</span>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-800">{item.total_inward}</p>
                    <p className="text-xs text-slate-400">Inward</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{item.consumed}</p>
                    <p className="text-xs text-slate-400">Consumed</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${lowStock ? 'text-red-600' : 'text-green-600'}`}>{item.stock}</p>
                    <p className="text-xs text-slate-400">Stock</p>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar value={usedPercent} />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-400">{usedPercent}% consumed</span>
                    <span className="text-xs text-slate-400">{item.wastage_percent}% wastage</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <InventoryModal
          item={selectedItem}
          projectId={currentProject.id}
          onClose={() => { setShowModal(false); setSelectedItem(null); }}
          onSaved={() => { setShowModal(false); setSelectedItem(null); loadData(); }}
        />
      )}
    </div>
  );
}

function InventoryModal({ item, projectId, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    material: item?.material || '',
    unit: item?.unit || '',
    total_inward: item?.total_inward || 0,
    consumed: item?.consumed || 0,
    wastage_percent: item?.wastage_percent || 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.material.trim() || !form.unit.trim()) return alert('Material and unit are required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/inventory/${item.id}`, {
          total_inward: parseFloat(form.total_inward) || 0,
          consumed: parseFloat(form.consumed) || 0,
          wastage_percent: parseFloat(form.wastage_percent) || 0,
        });
      } else {
        await api.post('/inventory', {
          project_id: projectId,
          material: form.material,
          unit: form.unit,
          total_inward: parseFloat(form.total_inward) || 0,
          consumed: parseFloat(form.consumed) || 0,
          wastage_percent: parseFloat(form.wastage_percent) || 0,
        });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const stock = (parseFloat(form.total_inward) || 0) - (parseFloat(form.consumed) || 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Inventory' : 'Add Inventory Item'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Material *</label>
              <input type="text" value={form.material} onChange={e => set('material', e.target.value)}
                disabled={isEdit}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 disabled:bg-slate-50"
                placeholder="e.g., Cement" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Unit *</label>
              <input type="text" value={form.unit} onChange={e => set('unit', e.target.value)}
                disabled={isEdit}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 disabled:bg-slate-50"
                placeholder="e.g., bags" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Total Inward</label>
              <input type="number" value={form.total_inward} onChange={e => set('total_inward', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" min="0" step="0.1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Consumed</label>
              <input type="number" value={form.consumed} onChange={e => set('consumed', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" min="0" step="0.1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Wastage %</label>
              <input type="number" value={form.wastage_percent} onChange={e => set('wastage_percent', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" min="0" max="100" step="0.1" />
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">Calculated Stock</p>
            <p className={`text-2xl font-bold ${stock < 0 ? 'text-red-600' : 'text-green-600'}`}>{stock.toFixed(1)}</p>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
