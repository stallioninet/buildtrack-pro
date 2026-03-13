import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { formatCurrency } from '../utils/formatters';
import { showError, showWarning } from '../utils/toast';

const CATEGORY_META = {
  material: {
    label: 'Material Rates',
    description: 'Material quantities per sq ft and unit prices',
    color: 'blue',
    fields: [
      { key: 'qty', label: 'Qty / sq ft', type: 'number', step: '0.001' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'unitPrice', label: 'Unit Price (₹)', type: 'number', step: '1' },
      { key: 'note', label: 'Reference / Note', type: 'text' },
    ],
    columns: ['Label', 'Qty/sqft', 'Unit', 'Unit Price', 'Note'],
    renderRow: (v) => [v.qty, v.unit, formatCurrency(v.unitPrice), v.note],
  },
  labour: {
    label: 'Labour Rates',
    description: 'Labour cost per sq ft by work type',
    color: 'orange',
    fields: [
      { key: 'rate', label: 'Rate (₹/sq ft)', type: 'number', step: '1' },
      { key: 'percent', label: 'Share %', type: 'number', step: '1' },
    ],
    columns: ['Label', 'Rate/sqft', 'Share %'],
    renderRow: (v) => [formatCurrency(v.rate), `${v.percent}%`],
  },
  city: {
    label: 'City Multipliers',
    description: 'Location-based cost adjustment factors',
    color: 'green',
    fields: [
      { key: 'factor', label: 'Multiplier', type: 'number', step: '0.01' },
    ],
    columns: ['Label', 'Multiplier', 'Adjustment'],
    renderRow: (v) => [v.factor.toFixed(2), `${v.factor >= 1 ? '+' : ''}${Math.round((v.factor - 1) * 100)}%`],
  },
  finish: {
    label: 'Finish Levels',
    description: 'Construction quality tiers and base cost per sq ft',
    color: 'purple',
    fields: [
      { key: 'costPerSqft', label: 'Cost / sq ft (₹)', type: 'number', step: '100' },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    columns: ['Label', 'Cost/sqft', 'Description'],
    renderRow: (v) => [formatCurrency(v.costPerSqft), v.description],
  },
  cost_category: {
    label: 'Stage-wise Cost Rates',
    description: 'Per sq ft rates by construction stage and finish level',
    color: 'indigo',
    fields: [
      { key: 'basic', label: 'Basic (₹/sqft)', type: 'number', step: '5' },
      { key: 'standard', label: 'Standard (₹/sqft)', type: 'number', step: '5' },
      { key: 'premium', label: 'Premium (₹/sqft)', type: 'number', step: '5' },
      { key: 'luxury', label: 'Luxury (₹/sqft)', type: 'number', step: '5' },
    ],
    columns: ['Label', 'Basic', 'Standard', 'Premium', 'Luxury'],
    renderRow: (v) => [formatCurrency(v.basic), formatCurrency(v.standard), formatCurrency(v.premium), formatCurrency(v.luxury)],
  },
  steel_distribution: {
    label: 'Steel Distribution',
    description: 'Steel percentage allocation by structural component',
    color: 'red',
    fields: [
      { key: 'percent', label: 'Percentage %', type: 'number', step: '1' },
    ],
    columns: ['Label', 'Percentage'],
    renderRow: (v) => [`${v.percent}%`],
  },
  floor_steel: {
    label: 'Floor Steel Rates',
    description: 'Steel kg per sq ft by number of floors',
    color: 'yellow',
    fields: [
      { key: 'steelPerSqft', label: 'Steel (kg/sqft)', type: 'number', step: '0.1' },
    ],
    columns: ['Label', 'Steel kg/sqft'],
    renderRow: (v) => [`${v.steelPerSqft} kg`],
  },
};

const CATEGORY_ORDER = ['material', 'labour', 'city', 'finish', 'cost_category', 'steel_distribution', 'floor_steel'];

const BORDER_COLORS = {
  blue: 'border-blue-400',
  orange: 'border-orange-400',
  green: 'border-green-400',
  purple: 'border-purple-400',
  indigo: 'border-indigo-400',
  red: 'border-red-400',
  yellow: 'border-yellow-400',
};

const BG_COLORS = {
  blue: 'bg-blue-50',
  orange: 'bg-orange-50',
  green: 'bg-green-50',
  purple: 'bg-purple-50',
  indigo: 'bg-indigo-50',
  red: 'bg-red-50',
  yellow: 'bg-yellow-50',
};

export default function RatesMasterPage() {
  const { user } = useAuth();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('material');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ item_key: '', label: '' });
  const [saving, setSaving] = useState(false);

  const canEdit = ['pm', 'owner'].includes(user?.role);

  const loadRates = () => {
    setLoading(true);
    api.get('/estimator/rates')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRates(); }, []);

  const meta = CATEGORY_META[activeTab];
  const items = data[activeTab] || [];

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ label: item.label, ...item.value });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (item) => {
    setSaving(true);
    try {
      const value = {};
      for (const f of meta.fields) {
        const raw = editForm[f.key];
        value[f.key] = f.type === 'number' ? Number(raw) : raw;
      }
      await api.patch(`/estimator/rates/${item.id}`, {
        label: editForm.label,
        value,
      });
      setEditingId(null);
      setEditForm({});
      loadRates();
    } catch (err) {
      showError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteRate = async (item) => {
    if (!confirm(`Delete "${item.label}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/estimator/rates/${item.id}`);
      loadRates();
    } catch (err) {
      showError(err.message || 'Failed to delete');
    }
  };

  const openAdd = () => {
    const initial = { item_key: '', label: '' };
    for (const f of meta.fields) {
      initial[f.key] = f.type === 'number' ? 0 : '';
    }
    setAddForm(initial);
    setShowAdd(true);
  };

  const saveAdd = async () => {
    if (!addForm.item_key || !addForm.label) {
      showWarning('Key and Label are required');
      return;
    }
    setSaving(true);
    try {
      const value = {};
      for (const f of meta.fields) {
        const raw = addForm[f.key];
        value[f.key] = f.type === 'number' ? Number(raw) : raw;
      }
      await api.post('/estimator/rates', {
        category: activeTab,
        item_key: addForm.item_key,
        label: addForm.label,
        value,
      });
      setShowAdd(false);
      loadRates();
    } catch (err) {
      showError(err.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading rates...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estimator Master Rates</h1>
          <p className="text-sm text-slate-500 mt-1">Manage the cost estimation parameters used in the Construction Estimator</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Add Rate
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_ORDER.map((cat) => {
          const m = CATEGORY_META[cat];
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => { setActiveTab(cat); cancelEdit(); setShowAdd(false); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? `${BG_COLORS[m.color]} ${BORDER_COLORS[m.color]} border-2 text-slate-800`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
              }`}
            >
              {m.label}
              <span className="ml-1.5 text-xs bg-white/60 px-1.5 py-0.5 rounded">{(data[cat] || []).length}</span>
            </button>
          );
        })}
      </div>

      {/* Active Category */}
      <div className={`bg-white rounded-xl border-2 ${BORDER_COLORS[meta.color]} p-6`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">{meta.label}</h3>
          <p className="text-xs text-slate-400">{meta.description}</p>
        </div>

        {/* Add Form */}
        {showAdd && canEdit && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-3">Add New Rate</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-600 font-medium">Key (unique)</label>
                <input
                  value={addForm.item_key}
                  onChange={(e) => setAddForm({ ...addForm, item_key: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="e.g. gravel"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Label</label>
                <input
                  value={addForm.label}
                  onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Gravel (40mm)"
                />
              </div>
              {meta.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-slate-600 font-medium">{f.label}</label>
                  <input
                    type={f.type}
                    step={f.step}
                    value={addForm[f.key] ?? ''}
                    onChange={(e) => setAddForm({ ...addForm, [f.key]: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={saveAdd}
                disabled={saving}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-2.5 px-3 text-slate-500 font-medium w-8">#</th>
                {meta.columns.map((col) => (
                  <th key={col} className="text-left py-2.5 px-3 text-slate-500 font-medium">{col}</th>
                ))}
                {canEdit && <th className="text-right py-2.5 px-3 text-slate-500 font-medium w-24">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isEditing = editingId === item.id;
                const vals = meta.renderRow(item.value);

                if (isEditing) {
                  return (
                    <tr key={item.id} className="border-t border-slate-100 bg-blue-50">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          value={editForm.label || ''}
                          onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      {meta.fields.map((f) => (
                        <td key={f.key} className="py-2 px-3">
                          <input
                            type={f.type}
                            step={f.step}
                            value={editForm[f.key] ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => saveEdit(item)}
                            disabled={saving}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                    <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {item.label}
                      <span className="ml-2 text-xs text-slate-400 font-normal">{item.item_key}</span>
                    </td>
                    {vals.map((v, i) => (
                      <td key={i} className="py-2.5 px-3 text-slate-600">{v}</td>
                    ))}
                    {canEdit && (
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(item)}
                            className="px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRate(item)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 text-xs rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="text-center py-8 text-slate-400">No rates in this category</div>
          )}
        </div>
      </div>
    </div>
  );
}
