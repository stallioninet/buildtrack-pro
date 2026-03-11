import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import CommentsSection from '../components/shared/CommentsSection';

const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Verified', 'Approved', 'Paid', 'Rejected'];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Verified: 'bg-purple-100 text-purple-700',
  Approved: 'bg-green-100 text-green-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default function RABillsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [summary, setSummary] = useState({ total: 0, totalGross: 0, totalNet: 0, totalRetention: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

  const canManage = ['owner', 'pm', 'accounts', 'engineer'].includes(user?.role);

  const loadBills = () => {
    if (!currentProject?.id) return;
    setLoading(true);
    api.get(`/ra-bills?project_id=${currentProject.id}${statusFilter ? `&status=${statusFilter}` : ''}`)
      .then(setBills)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadSummary = () => {
    if (!currentProject?.id) return;
    api.get(`/ra-bills/summary?project_id=${currentProject.id}`)
      .then(setSummary)
      .catch(console.error);
  };

  useEffect(() => { loadBills(); }, [currentProject?.id, statusFilter]);
  useEffect(() => { loadSummary(); }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/vendors?project_id=${currentProject.id}`)
      .then(v => setVendors(Array.isArray(v) ? v : v.vendors || []))
      .catch(() => setVendors([]));
  }, [currentProject?.id]);

  const handleStatusChange = async (bill, newStatus) => {
    try {
      await api.patch(`/ra-bills/${bill.id}/status`, { status: newStatus });
      loadBills();
      loadSummary();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (bill) => {
    if (!confirm(`Delete RA Bill ${bill.bill_code}?`)) return;
    try {
      await api.delete(`/ra-bills/${bill.id}`);
      loadBills();
      loadSummary();
    } catch (err) {
      alert(err.message || 'Failed to delete bill');
    }
  };

  const openCreate = () => {
    setEditingBill(null);
    setShowModal(true);
  };

  const openEdit = (bill) => {
    setEditingBill(bill);
    setShowModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editingBill) {
        await api.patch(`/ra-bills/${editingBill.id}`, data);
      } else {
        await api.post('/ra-bills', { ...data, project_id: currentProject.id });
      }
      setShowModal(false);
      setEditingBill(null);
      loadBills();
      loadSummary();
    } catch (err) {
      alert(err.message || 'Failed to save RA Bill');
    }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;
  if (loading) return <div className="text-center py-12 text-slate-500">Loading RA Bills...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">RA Bills</h1>
        {canManage && (
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            + New RA Bill
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Bills" value={summary.total} color="blue" />
        <StatCard label="Total Gross" value={formatCurrency(summary.totalGross)} color="purple" />
        <StatCard label="Total Net Payable" value={formatCurrency(summary.totalNet)} color="green" />
        <StatCard label="Total Retention" value={formatCurrency(summary.totalRetention)} color="orange" />
        <StatCard label="Pending" value={summary.pending} color="yellow" />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500 font-medium">Filter by Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Bill Cards */}
      <div className="space-y-4">
        {bills.map((bill) => (
          <div
            key={bill.id}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openEdit(bill)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{bill.bill_code}</span>
                  <span className="text-xs text-slate-400">Bill #{bill.bill_number}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-700 mt-1">{bill.title}</h3>
                {bill.vendor_name && (
                  <p className="text-xs text-slate-500 mt-0.5">Vendor: {bill.vendor_name}</p>
                )}
                {(bill.period_from || bill.period_to) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Period: {formatDate(bill.period_from)} - {formatDate(bill.period_to)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {canManage ? (
                  <select
                    value={bill.status}
                    onChange={(e) => handleStatusChange(bill, e.target.value)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[bill.status] || 'bg-slate-100 text-slate-700'}`}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[bill.status] || 'bg-slate-100 text-slate-700'}`}>
                    {bill.status}
                  </span>
                )}
                {['owner', 'pm'].includes(user?.role) && (
                  <button
                    onClick={() => handleDelete(bill)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium ml-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Amount Details */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gross Amount</p>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(bill.gross_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Previous</p>
                <p className="text-sm font-semibold text-slate-500">{formatCurrency(bill.previous_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Current</p>
                <p className="text-sm font-semibold text-blue-600">{formatCurrency(bill.current_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Retention ({bill.retention_percent}%)</p>
                <p className="text-sm font-semibold text-orange-600">{formatCurrency(bill.retention_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Net Payable</p>
                <p className="text-sm font-bold text-green-600">{formatCurrency(bill.net_payable)}</p>
              </div>
            </div>

            {bill.prepared_by_name && (
              <p className="text-[10px] text-slate-400 mt-2">Prepared by: {bill.prepared_by_name}{bill.approved_by_name ? ` | Approved by: ${bill.approved_by_name}` : ''}</p>
            )}
          </div>
        ))}
        {bills.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
            No RA Bills found
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <RABillModal
          bill={editingBill}
          vendors={vendors}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingBill(null); }}
        />
      )}
    </div>
  );
}

function RABillModal({ bill, vendors, onSave, onClose }) {
  const [form, setForm] = useState({
    title: bill?.title || '',
    description: bill?.description || '',
    vendor_id: bill?.vendor_id || '',
    period_from: bill?.period_from?.split('T')[0] || '',
    period_to: bill?.period_to?.split('T')[0] || '',
    gross_amount: bill?.gross_amount || '',
    previous_amount: bill?.previous_amount || 0,
    retention_percent: bill?.retention_percent || 5,
    deductions: bill?.deductions || 0,
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const gross = parseFloat(form.gross_amount) || 0;
  const prev = parseFloat(form.previous_amount) || 0;
  const currentAmount = gross - prev;
  const retPct = parseFloat(form.retention_percent) || 0;
  const retentionAmount = Math.round(currentAmount * retPct / 100);
  const ded = parseFloat(form.deductions) || 0;
  const netPayable = currentAmount - retentionAmount - ded;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title) {
      alert('Title is required');
      return;
    }
    onSave({
      title: form.title,
      description: form.description || null,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
      period_from: form.period_from || null,
      period_to: form.period_to || null,
      gross_amount: gross,
      previous_amount: prev,
      retention_percent: retPct,
      deductions: ded,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-800">
            {bill ? `Edit ${bill.bill_code}` : 'New RA Bill'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              placeholder="RA Bill title"
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none"
              rows={2}
              placeholder="Bill description..."
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Vendor</label>
            <select
              value={form.vendor_id}
              onChange={(e) => handleChange('vendor_id', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
            >
              <option value="">Select vendor...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Period From</label>
              <input
                type="date"
                value={form.period_from}
                onChange={(e) => handleChange('period_from', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Period To</label>
              <input
                type="date"
                value={form.period_to}
                onChange={(e) => handleChange('period_to', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Gross Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.gross_amount}
                onChange={(e) => handleChange('gross_amount', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Previous Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.previous_amount}
                onChange={(e) => handleChange('previous_amount', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Auto-calculated Current Amount */}
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-500 font-medium">Current Amount (Gross - Previous)</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(currentAmount)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Retention %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.retention_percent}
                onChange={(e) => handleChange('retention_percent', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Retention: {formatCurrency(retentionAmount)}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Deductions</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.deductions}
                onChange={(e) => handleChange('deductions', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Auto-calculated Net Payable */}
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-500 font-medium">Net Payable (Current - Retention - Deductions)</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(netPayable)}</p>
          </div>

          {/* Comments for edit mode */}
          {bill && (
            <CommentsSection entityType="ra_bill" entityId={bill.id} />
          )}

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
              {bill ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
