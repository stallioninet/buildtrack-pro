import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/formatters';

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Paid', 'Cancelled'];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

export default function PaymentsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const canManage = ['owner', 'pm', 'accounts'].includes(user?.role);

  const loadPayments = () => {
    if (!currentProject?.id) return;
    setLoading(true);
    api.get(`/payments?project_id=${currentProject.id}${statusFilter ? `&status=${statusFilter}` : ''}`)
      .then(setPayments)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPayments(); }, [currentProject?.id, statusFilter]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api.get(`/vendors?project_id=${currentProject.id}`).then(v => setVendors(Array.isArray(v) ? v : v.vendors || [])).catch(() => setVendors([]));
    api.get(`/stages?project_id=${currentProject.id}`).then(s => setStages(Array.isArray(s) ? s : s.stages || [])).catch(() => setStages([]));
  }, [currentProject?.id]);

  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paidAmount = payments.reduce((sum, p) => p.status === 'Paid' ? sum + (parseFloat(p.amount) || 0) : sum, 0);
  const pendingCount = payments.filter(p => p.status === 'Pending Approval').length;

  const handleStatusChange = async (payment, newStatus) => {
    try {
      await api.patch(`/payments/${payment.id}/status`, { status: newStatus });
      loadPayments();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (payment) => {
    if (!confirm(`Delete payment ${payment.payment_code}?`)) return;
    try {
      await api.delete(`/payments/${payment.id}`);
      loadPayments();
    } catch (err) {
      alert(err.message || 'Failed to delete payment');
    }
  };

  const openCreate = () => {
    setEditingPayment(null);
    setShowModal(true);
  };

  const openEdit = (payment) => {
    setEditingPayment(payment);
    setShowModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editingPayment) {
        await api.patch(`/payments/${editingPayment.id}`, data);
      } else {
        await api.post('/payments', { ...data, project_id: currentProject.id });
      }
      setShowModal(false);
      setEditingPayment(null);
      loadPayments();
    } catch (err) {
      alert(err.message || 'Failed to save payment');
    }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;
  if (loading) return <div className="text-center py-12 text-slate-500">Loading payments...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Payments</h1>
        {canManage && (
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            + Add Payment
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 font-medium">Total Payments</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{payments.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 font-medium">Total Amount</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 font-medium">Paid Amount</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 font-medium">Pending Approval</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
        </div>
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Code</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Vendor</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Stage</th>
              <th className="text-right py-3 px-4 text-slate-500 font-medium">Amount</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Date</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
              {canManage && <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((pay) => (
              <tr
                key={pay.id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => canManage && openEdit(pay)}
              >
                <td className="py-3 px-4 font-medium text-slate-700">{pay.payment_code}</td>
                <td className="py-3 px-4 text-slate-600">{pay.vendor_name || '-'}</td>
                <td className="py-3 px-4 text-slate-600">{pay.stage_name || '-'}</td>
                <td className="py-3 px-4 text-right font-medium text-slate-800">{formatCurrency(pay.amount)}</td>
                <td className="py-3 px-4 text-slate-600">{formatDate(pay.payment_date)}</td>
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  {canManage ? (
                    <select
                      value={pay.status}
                      onChange={(e) => handleStatusChange(pay, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[pay.status] || 'bg-slate-100 text-slate-700'}`}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[pay.status] || 'bg-slate-100 text-slate-700'}`}>
                      {pay.status}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(pay)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <div className="text-center py-8 text-slate-400">No payments found</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PaymentModal
          payment={editingPayment}
          vendors={vendors}
          stages={stages}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPayment(null); }}
        />
      )}
    </div>
  );
}

function PaymentModal({ payment, vendors, stages, onSave, onClose }) {
  const [form, setForm] = useState({
    vendor_id: payment?.vendor_id || '',
    stage_id: payment?.stage_id || '',
    amount: payment?.amount || '',
    payment_date: payment?.payment_date?.split('T')[0] || new Date().toISOString().split('T')[0],
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.vendor_id || !form.amount) {
      alert('Vendor and amount are required');
      return;
    }
    onSave({
      vendor_id: parseInt(form.vendor_id),
      stage_id: form.stage_id ? parseInt(form.stage_id) : null,
      amount: parseFloat(form.amount),
      payment_date: form.payment_date,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {payment ? 'Edit Payment' : 'New Payment'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Vendor *</label>
            <select
              value={form.vendor_id}
              onChange={(e) => handleChange('vendor_id', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              required
            >
              <option value="">Select vendor...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Stage</label>
            <select
              value={form.stage_id}
              onChange={(e) => handleChange('stage_id', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
            >
              <option value="">Select stage...</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Payment Date</label>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => handleChange('payment_date', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
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
              {payment ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
