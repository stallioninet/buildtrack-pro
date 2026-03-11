import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/formatters';

const CATEGORIES = ['Labor', 'Material', 'Equipment', 'Transport', 'Permits', 'Utilities', 'Subcontractor', 'Overhead', 'Other'];
const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Paid'];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Paid: 'bg-blue-100 text-blue-700',
};

export default function ExpensesPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', category: '' });
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [stages, setStages] = useState([]);

  const canCreate = ['owner', 'pm', 'accounts', 'engineer'].includes(user?.role);
  const canDelete = ['owner', 'pm', 'accounts'].includes(user?.role);
  const canChangeStatus = ['owner', 'pm', 'accounts'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    Promise.all([
      api.get(`/expenses?project_id=${pid}${filter.status ? `&status=${filter.status}` : ''}${filter.category ? `&category=${filter.category}` : ''}`),
      api.get(`/expenses/summary?project_id=${pid}`),
    ]).then(([expensesData, summaryData]) => {
      setExpenses(expensesData);
      setSummary(summaryData);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => {});
  }, [currentProject?.id]);

  const handleStatusChange = async (expense, newStatus) => {
    try {
      await api.patch(`/expenses/${expense.id}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (e, expense) => {
    e.stopPropagation();
    if (!confirm(`Delete expense "${expense.description || expense.category}"?`)) return;
    try {
      await api.delete(`/expenses/${expense.id}`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  const approvedAmount = summary?.byStatus?.find(s => s.status === 'Approved')?.amount || 0;
  const paidAmount = summary?.byStatus?.find(s => s.status === 'Paid')?.amount || 0;
  const pendingCount = summary?.byStatus?.find(s => s.status === 'Pending Approval')?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track project costs by category and approval status</p>
        </div>
        {canCreate && (
          <button onClick={() => { setSelectedExpense(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + Add Expense
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
            <p className="text-xs text-slate-500">Total Expenses</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalAmount || 0)}</p>
            <p className="text-xs text-slate-500">Total Amount</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-green-600">{formatCurrency((approvedAmount || 0) + (paidAmount || 0))}</p>
            <p className="text-xs text-slate-500">Approved + Paid</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-slate-500">Pending Approval</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading expenses...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No expenses found</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Date</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Category</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Description</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Stage</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">Amount</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                {canDelete && <th className="text-center py-3 px-4 text-slate-500 font-medium w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => { if (canCreate) { setSelectedExpense(exp); setShowModal(true); } }}>
                  <td className="py-3 px-4 text-slate-600">{formatDate(exp.expense_date)}</td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{exp.description || '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{exp.stage_name || '-'}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-800">{formatCurrency(exp.amount)}</td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    {canChangeStatus && exp.status !== 'Paid' ? (
                      <select
                        value={exp.status}
                        onChange={e => handleStatusChange(exp, e.target.value)}
                        className={`text-[10px] px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[exp.status] || 'bg-slate-100 text-slate-600'}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[exp.status] || 'bg-slate-100 text-slate-600'}`}>
                        {exp.status}
                      </span>
                    )}
                  </td>
                  {canDelete && (
                    <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={e => handleDelete(e, exp)}
                        className="text-slate-300 hover:text-red-500 text-sm" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Modal */}
      {showModal && (
        <ExpenseModal
          expense={selectedExpense}
          projectId={currentProject.id}
          stages={stages}
          onClose={() => { setShowModal(false); setSelectedExpense(null); }}
          onSaved={() => { setShowModal(false); setSelectedExpense(null); loadData(); }}
        />
      )}
    </div>
  );
}

function ExpenseModal({ expense, projectId, stages, onClose, onSaved }) {
  const isEdit = !!expense;
  const [form, setForm] = useState({
    expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
    category: expense?.category || 'Material',
    description: expense?.description || '',
    amount: expense?.amount || '',
    stage_id: expense?.stage_id || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return alert('Amount is required and must be greater than 0');
    if (!form.expense_date) return alert('Date is required');
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (isEdit) {
        await api.patch(`/expenses/${expense.id}`, payload);
      } else {
        await api.post('/expenses', { ...payload, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      alert(err.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Edit Expense' : 'Add New Expense'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Row: Date + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Date *</label>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Amount + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Amount *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="0.00" />
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
              placeholder="Details about this expense" />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
