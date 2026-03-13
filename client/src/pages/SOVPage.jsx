import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { showError } from '../utils/toast';
import ProgressBar from '../components/ui/ProgressBar';

const TRADES = [
  'General Conditions', 'Site Work', 'Concrete', 'Masonry', 'Metals',
  'Wood & Plastics', 'Thermal & Moisture', 'Doors & Windows', 'Finishes',
  'Specialties', 'Equipment', 'Furnishings', 'Mechanical', 'Electrical', 'Other',
];

export default function SOVPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalScheduled: 0, billedToDate: 0, remaining: 0, percentComplete: 0, totalRetainage: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [billingMode, setBillingMode] = useState(false);
  const [billingData, setBillingData] = useState({});
  const [stages, setStages] = useState([]);

  const canManage = ['pm', 'accounts', 'owner'].includes(user?.role);

  const loadItems = () => {
    if (!currentProject?.id) return;
    setLoading(true);
    api.get(`/sov?project_id=${currentProject.id}`)
      .then(data => setItems(Array.isArray(data) ? data : data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadSummary = () => {
    if (!currentProject?.id) return;
    api.get(`/sov/summary?project_id=${currentProject.id}`)
      .then(setSummary)
      .catch(console.error);
  };

  useEffect(() => { loadItems(); }, [currentProject?.id]);
  useEffect(() => { loadSummary(); }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`)
      .then(s => setStages(Array.isArray(s) ? s : s.stages || []))
      .catch(() => setStages([]));
  }, [currentProject?.id]);

  const openCreate = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    if (billingMode) return;
    setEditingItem(item);
    setShowModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        await api.patch(`/sov/${editingItem.id}`, data);
      } else {
        await api.post('/sov', { ...data, project_id: currentProject.id });
      }
      setShowModal(false);
      setEditingItem(null);
      loadItems();
      loadSummary();
    } catch (err) {
      showError(err.message || 'Failed to save line item');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete line item "${item.description}"?`)) return;
    try {
      await api.delete(`/sov/${item.id}`);
      loadItems();
      loadSummary();
    } catch (err) {
      showError(err.message || 'Failed to delete line item');
    }
  };

  const startBilling = () => {
    const initial = {};
    items.forEach(item => {
      initial[item.id] = {
        current_period: 0,
        stored_materials: item.stored_materials || 0,
      };
    });
    setBillingData(initial);
    setBillingMode(true);
  };

  const cancelBilling = () => {
    setBillingMode(false);
    setBillingData({});
  };

  const handleBillingChange = (itemId, field, value) => {
    setBillingData(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: parseFloat(value) || 0 },
    }));
  };

  const submitBilling = async () => {
    try {
      const billingItems = Object.entries(billingData).map(([id, data]) => ({
        id: parseInt(id),
        current_period: data.current_period,
        stored_materials: data.stored_materials,
      }));
      await api.post('/sov/billing', {
        project_id: currentProject.id,
        items: billingItems,
      });
      setBillingMode(false);
      setBillingData({});
      loadItems();
      loadSummary();
    } catch (err) {
      showError(err.message || 'Failed to submit billing');
    }
  };

  // Compute totals for the footer row
  const totals = items.reduce((acc, item) => {
    const bd = billingMode ? billingData[item.id] : null;
    const currentPeriod = bd ? bd.current_period : (item.current_period || 0);
    const storedMaterials = bd ? bd.stored_materials : (item.stored_materials || 0);
    const totalCompleted = (item.previous_billed || 0) + currentPeriod + storedMaterials;
    const scheduled = item.scheduled_value || 0;
    const retainage = scheduled > 0 ? totalCompleted * (item.retainage_percent || 0) / 100 : 0;

    acc.scheduled += scheduled;
    acc.previousBilled += item.previous_billed || 0;
    acc.currentPeriod += currentPeriod;
    acc.storedMaterials += storedMaterials;
    acc.totalCompleted += totalCompleted;
    acc.retainage += retainage;
    return acc;
  }, { scheduled: 0, previousBilled: 0, currentPeriod: 0, storedMaterials: 0, totalCompleted: 0, retainage: 0 });

  const totalsPercent = totals.scheduled > 0 ? Math.round(totals.totalCompleted / totals.scheduled * 100) : 0;

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;
  if (loading) return <div className="text-center py-12 text-slate-500">Loading Schedule of Values...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Schedule of Values</h1>
        <div className="flex items-center gap-2">
          {canManage && !billingMode && (
            <>
              <button onClick={startBilling} className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors">
                Start Billing Period
              </button>
              <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                + Add Line Item
              </button>
            </>
          )}
          {billingMode && (
            <>
              <button onClick={cancelBilling} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={submitBilling} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                Submit Billing
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Scheduled Value</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(summary.totalScheduled || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Billed to Date</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(summary.billedToDate || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Remaining</p>
          <p className="text-lg font-bold text-amber-600 mt-1">{formatCurrency(summary.remaining || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Overall % Complete</p>
          <p className="text-sm font-bold text-slate-700 mt-1 mb-1">{summary.percentComplete || 0}%</p>
          <ProgressBar value={summary.percentComplete || 0} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Retainage</p>
          <p className="text-lg font-bold text-orange-600 mt-1">{formatCurrency(summary.totalRetainage || 0)}</p>
        </div>
      </div>

      {/* SOV Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left py-3 px-3 text-slate-500 font-medium w-10">#</th>
              <th className="text-left py-3 px-3 text-slate-500 font-medium">Cost Code</th>
              <th className="text-left py-3 px-3 text-slate-500 font-medium">Description</th>
              <th className="text-left py-3 px-3 text-slate-500 font-medium">Trade</th>
              <th className="text-left py-3 px-3 text-slate-500 font-medium">Stage</th>
              <th className="text-right py-3 px-3 text-slate-500 font-medium">Scheduled Value</th>
              <th className="text-right py-3 px-3 text-slate-500 font-medium">Previous Billed</th>
              <th className="text-right py-3 px-3 text-slate-500 font-medium">Current Period</th>
              <th className="text-right py-3 px-3 text-slate-500 font-medium">Stored Materials</th>
              <th className="text-right py-3 px-3 text-slate-500 font-medium">Total Completed</th>
              <th className="text-center py-3 px-3 text-slate-500 font-medium w-28">% Complete</th>
              <th className="text-right py-3 px-3 text-slate-500 font-medium">Retainage</th>
              {canManage && !billingMode && <th className="text-center py-3 px-3 text-slate-500 font-medium w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const bd = billingMode ? billingData[item.id] : null;
              const currentPeriod = bd ? bd.current_period : (item.current_period || 0);
              const storedMaterials = bd ? bd.stored_materials : (item.stored_materials || 0);
              const totalCompleted = (item.previous_billed || 0) + currentPeriod + storedMaterials;
              const scheduled = item.scheduled_value || 0;
              const pctComplete = scheduled > 0 ? Math.round(totalCompleted / scheduled * 100) : 0;
              const retainage = totalCompleted * (item.retainage_percent || 0) / 100;
              const isComplete = pctComplete >= 100;
              const isOverBilled = pctComplete > 100;

              let rowClass = 'border-t border-slate-100 hover:bg-slate-50';
              if (isOverBilled) {
                rowClass = 'border-t border-slate-100 bg-amber-50';
              } else if (isComplete) {
                rowClass = 'border-t border-slate-100 bg-green-50';
              }

              return (
                <tr
                  key={item.id}
                  className={`${rowClass} ${!billingMode ? 'cursor-pointer' : ''}`}
                  onClick={() => canManage && openEdit(item)}
                >
                  <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3 text-slate-700 font-mono text-xs">{item.cost_code}</td>
                  <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{item.description}</td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      {item.trade}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-xs">{item.stage_name || '-'}</td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">{formatCurrency(scheduled)}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(item.previous_billed || 0)}</td>
                  <td className="py-3 px-3 text-right" onClick={e => billingMode && e.stopPropagation()}>
                    {billingMode ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bd?.current_period || ''}
                        onChange={e => handleBillingChange(item.id, 'current_period', e.target.value)}
                        className="w-24 text-sm text-right border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <span className="text-blue-600 font-medium">{formatCurrency(currentPeriod)}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right" onClick={e => billingMode && e.stopPropagation()}>
                    {billingMode ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bd?.stored_materials || ''}
                        onChange={e => handleBillingChange(item.id, 'stored_materials', e.target.value)}
                        className="w-24 text-sm text-right border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <span className="text-slate-600">{formatCurrency(storedMaterials)}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">{formatCurrency(totalCompleted)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={Math.min(pctComplete, 100)} className="flex-1" />
                      <span className={`text-xs font-medium w-10 text-right ${isOverBilled ? 'text-amber-600' : isComplete ? 'text-green-600' : 'text-slate-600'}`}>
                        {pctComplete}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-orange-600">{formatCurrency(retainage)}</td>
                  {canManage && !billingMode && (
                    <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-slate-300 hover:text-red-500 text-sm"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Totals Row */}
            {items.length > 0 && (
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-slate-800">TOTALS</td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-right text-slate-800">{formatCurrency(totals.scheduled)}</td>
                <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(totals.previousBilled)}</td>
                <td className="py-3 px-3 text-right text-blue-600">{formatCurrency(totals.currentPeriod)}</td>
                <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(totals.storedMaterials)}</td>
                <td className="py-3 px-3 text-right text-slate-800">{formatCurrency(totals.totalCompleted)}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={Math.min(totalsPercent, 100)} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right text-slate-600">{totalsPercent}%</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right text-orange-600">{formatCurrency(totals.retainage)}</td>
                {canManage && !billingMode && <td className="py-3 px-3"></td>}
              </tr>
            )}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            No line items found. Add your first Schedule of Values line item.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <SOVModal
          item={editingItem}
          stages={stages}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

function SOVModal({ item, stages, onSave, onClose }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    cost_code: item?.cost_code || '',
    description: item?.description || '',
    trade: item?.trade || 'General Conditions',
    stage_id: item?.stage_id || '',
    scheduled_value: item?.scheduled_value || '',
    retainage_percent: item?.retainage_percent ?? 5,
    sort_order: item?.sort_order || 0,
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.cost_code || !form.description) {
      showError('Cost code and description are required');
      return;
    }
    if (!form.scheduled_value || parseFloat(form.scheduled_value) <= 0) {
      showError('Scheduled value must be greater than 0');
      return;
    }
    onSave({
      cost_code: form.cost_code,
      description: form.description,
      trade: form.trade,
      stage_id: form.stage_id ? parseInt(form.stage_id) : null,
      scheduled_value: parseFloat(form.scheduled_value),
      retainage_percent: parseFloat(form.retainage_percent) || 0,
      sort_order: parseInt(form.sort_order) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? 'Edit Line Item' : 'Add Line Item'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Cost Code *</label>
              <input
                type="text"
                value={form.cost_code}
                onChange={e => handleChange('cost_code', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                placeholder="e.g. 03-100"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Sort Order</label>
              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={e => handleChange('sort_order', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Description *</label>
            <input
              type="text"
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              placeholder="Line item description"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Trade</label>
              <select
                value={form.trade}
                onChange={e => handleChange('trade', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Stage</label>
              <select
                value={form.stage_id}
                onChange={e => handleChange('stage_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="">Select stage...</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Scheduled Value *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.scheduled_value}
                onChange={e => handleChange('scheduled_value', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Retainage %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.retainage_percent}
                onChange={e => handleChange('retainage_percent', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
