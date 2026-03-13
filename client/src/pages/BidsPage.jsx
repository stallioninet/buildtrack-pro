import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import { showError, showWarning } from '../utils/toast';
import CommentsSection from '../components/shared/CommentsSection';
import Pagination from '../components/ui/Pagination';
import { useModal } from '../hooks/useModal';

const BID_STATUSES = ['Draft', 'Open', 'Under Review', 'Awarded', 'Cancelled'];

const BID_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  Open: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Awarded: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const TRADES = [
  'General', 'Electrical', 'Plumbing', 'HVAC', 'Structural',
  'Finishing', 'Landscaping', 'Roofing', 'Flooring', 'Painting', 'Other',
];

export default function BidsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, awarded: 0, totalBudget: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', trade: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedBid, setSelectedBid] = useState(null);
  const modal = useModal();

  const canCreate = ['owner', 'pm', 'procurement'].includes(user?.role);
  const canDelete = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    const pid = currentProject.id;
    const params = new URLSearchParams({ project_id: pid, page, limit: 50 });
    if (filter.status) params.append('status', filter.status);
    if (filter.trade) params.append('trade', filter.trade);

    Promise.all([
      api.get(`/bids?${params}`),
      api.get(`/bids/summary?project_id=${pid}`),
    ]).then(([data, sum]) => {
      if (data && data.data) {
        setItems(data.data);
        setPagination(data.pagination);
      } else {
        setItems(Array.isArray(data) ? data : []);
        setPagination(null);
      }
      setSummary(sum || { total: 0, open: 0, awarded: 0, totalBudget: 0 });
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id, filter, page]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this bid package?')) return;
    try {
      await api.delete(`/bids/${id}`);
      if (selectedBid?.id === id) setSelectedBid(null);
      loadData();
    } catch (err) { showError(err.message); }
  };

  const handleSelectBid = (bid) => {
    setSelectedBid(selectedBid?.id === bid.id ? null : bid);
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bid Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage bid packages, responses, and vendor awards</p>
        </div>
        {canCreate && (
          <button onClick={() => modal.open('create')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Bid Package
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Packages" value={summary.total} color="blue" />
        <StatCard label="Open for Bidding" value={summary.open} color="orange" />
        <StatCard label="Awarded" value={summary.awarded} color="green" />
        <StatCard label="Total Budget" value={formatCurrency(summary.totalBudget)} color="purple" />
      </div>

      <div className="flex items-center gap-2">
        <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Statuses</option>
          {BID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.trade} onChange={e => { setFilter(f => ({ ...f, trade: e.target.value })); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All Trades</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No bid packages found</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
          {items.map(bid => (
            <div key={bid.id} className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow cursor-pointer ${selectedBid?.id === bid.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}
              onClick={() => handleSelectBid(bid)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{bid.bid_code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BID_STATUS_COLORS[bid.status] || 'bg-slate-100'}`}>
                      {bid.status}
                    </span>
                    {bid.trade && (
                      <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">
                        {bid.trade}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 hover:text-blue-600"
                    onClick={e => { e.stopPropagation(); modal.open('edit', bid); }}>
                    {bid.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                    {bid.budget_estimate > 0 && (
                      <span className="font-medium text-slate-500">Est: {formatCurrency(bid.budget_estimate)}</span>
                    )}
                    {bid.bid_due_date && (
                      <span>Due: {formatDate(bid.bid_due_date)}</span>
                    )}
                    <span>{bid.response_count || 0} bids received</span>
                    {bid.status === 'Awarded' && bid.awarded_vendor_name && (
                      <span className="text-green-600 font-medium">Awarded to: {bid.awarded_vendor_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {canCreate && (
                    <button onClick={() => modal.open('edit', bid)}
                      className="text-slate-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(bid.id)}
                      className="text-slate-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onPageChange={setPage} />
        </div>
      )}

      {selectedBid && (
        <BidDetailPanel
          bid={selectedBid}
          projectId={currentProject.id}
          canCreate={canCreate}
          onUpdated={() => { loadData(); }}
          onClose={() => setSelectedBid(null)}
        />
      )}

      {(modal.isOpen('create') || modal.isOpen('edit')) && (
        <BidModal
          bid={modal.data('edit')}
          projectId={currentProject.id}
          onClose={() => modal.closeAll()}
          onSaved={() => { modal.closeAll(); loadData(); }}
        />
      )}
    </div>
  );
}

function BidModal({ bid, projectId, onClose, onSaved }) {
  const isEdit = !!bid;
  const [form, setForm] = useState({
    title: bid?.title || '',
    description: bid?.description || '',
    trade: bid?.trade || '',
    scope_of_work: bid?.scope_of_work || '',
    budget_estimate: bid?.budget_estimate || 0,
    bid_due_date: bid?.bid_due_date ? bid.bid_due_date.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return showWarning('Title is required');
    if (!form.trade) return showWarning('Trade is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/bids/${bid.id}`, form);
      } else {
        await api.post('/bids', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            {isEdit ? `${bid.bid_code || ''} — Edit Bid Package` : 'New Bid Package'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-medium">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Bid package title" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Trade *</label>
              <select value={form.trade} onChange={e => set('trade', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select trade</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Budget Estimate</label>
              <input type="number" value={form.budget_estimate} onChange={e => set('budget_estimate', parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Bid Due Date</label>
              <input type="date" value={form.bid_due_date} onChange={e => set('bid_due_date', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Brief description of this bid package" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Scope of Work</label>
            <textarea value={form.scope_of_work} onChange={e => set('scope_of_work', e.target.value)}
              rows={4} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" placeholder="Detailed scope of work for bidders" />
          </div>
          {isEdit && <CommentsSection entityType="bid" entityId={bid.id} />}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BidDetailPanel({ bid, projectId, canCreate, onUpdated, onClose }) {
  const [responses, setResponses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [responseForm, setResponseForm] = useState({ vendor_id: '', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadResponses();
    loadVendors();
  }, [bid.id]);

  const loadResponses = () => {
    setLoadingResponses(true);
    api.get(`/bids/${bid.id}/responses`)
      .then(data => setResponses(Array.isArray(data) ? data : data?.data || []))
      .catch(console.error)
      .finally(() => setLoadingResponses(false));
  };

  const loadVendors = () => {
    api.get(`/vendors?project_id=${projectId}`)
      .then(data => setVendors(Array.isArray(data) ? data : data?.data || []))
      .catch(console.error);
  };

  const handleAddResponse = async () => {
    if (!responseForm.vendor_id) return showWarning('Select a vendor');
    if (!responseForm.amount || parseFloat(responseForm.amount) <= 0) return showWarning('Enter a valid amount');
    setSaving(true);
    try {
      await api.post(`/bids/${bid.id}/responses`, {
        vendor_id: parseInt(responseForm.vendor_id),
        amount: parseFloat(responseForm.amount),
        notes: responseForm.notes,
      });
      setResponseForm({ vendor_id: '', amount: '', notes: '' });
      setShowAddForm(false);
      loadResponses();
      onUpdated();
    } catch (err) { showError(err.message || 'Failed to add response'); }
    finally { setSaving(false); }
  };

  const handleScoreChange = async (responseId, score) => {
    const val = Math.min(100, Math.max(0, parseInt(score) || 0));
    try {
      await api.patch(`/bids/${bid.id}/responses/${responseId}`, { score: val });
      setResponses(prev => prev.map(r => r.id === responseId ? { ...r, score: val } : r));
    } catch (err) { showError(err.message || 'Failed to update score'); }
  };

  const handleAward = async (responseId) => {
    if (!confirm('Award this bid to the selected vendor?')) return;
    try {
      await api.post(`/bids/${bid.id}/award`, { response_id: responseId });
      loadResponses();
      onUpdated();
    } catch (err) { showError(err.message || 'Failed to award bid'); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-400">{bid.bid_code}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BID_STATUS_COLORS[bid.status] || 'bg-slate-100'}`}>
              {bid.status}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{bid.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            {bid.trade && <span>Trade: {bid.trade}</span>}
            {bid.budget_estimate > 0 && <span>Budget: {formatCurrency(bid.budget_estimate)}</span>}
            {bid.bid_due_date && <span>Due: {formatDate(bid.bid_due_date)}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
      </div>

      {bid.description && (
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-1">Description</h4>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{bid.description}</p>
        </div>
      )}

      {bid.scope_of_work && (
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-1">Scope of Work</h4>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{bid.scope_of_work}</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Bid Responses</h4>
          {canCreate && bid.status !== 'Awarded' && bid.status !== 'Cancelled' && (
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
              {showAddForm ? 'Cancel' : '+ Add Bid Response'}
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Vendor *</label>
                <select value={responseForm.vendor_id} onChange={e => setResponseForm(f => ({ ...f, vendor_id: e.target.value }))}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5">
                  <option value="">Select vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Amount *</label>
                <input type="number" value={responseForm.amount}
                  onChange={e => setResponseForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Notes</label>
                <input type="text" value={responseForm.notes}
                  onChange={e => setResponseForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5" placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleAddResponse} disabled={saving}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Response'}
              </button>
            </div>
          </div>
        )}

        {loadingResponses ? (
          <div className="text-center py-4 text-slate-400 text-xs">Loading responses...</div>
        ) : responses.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-xs">No bid responses yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Vendor</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium w-20">Score</th>
                  <th className="pb-2 font-medium">Notes</th>
                  <th className="pb-2 font-medium w-20">Selected</th>
                  {canCreate && bid.status !== 'Cancelled' && <th className="pb-2 font-medium w-24">Action</th>}
                </tr>
              </thead>
              <tbody>
                {responses.map(resp => (
                  <tr key={resp.id} className={`border-b border-slate-50 ${resp.is_selected ? 'bg-green-50' : ''}`}>
                    <td className="py-2 text-xs text-slate-700 font-medium">{resp.vendor_name || `Vendor #${resp.vendor_id}`}</td>
                    <td className="py-2 text-xs text-slate-600">{formatCurrency(resp.amount)}</td>
                    <td className="py-2">
                      {canCreate ? (
                        <input type="number" min="0" max="100" value={resp.score || ''}
                          onChange={e => handleScoreChange(resp.id, e.target.value)}
                          className="w-16 text-xs border border-slate-200 rounded px-1.5 py-1 text-center"
                          placeholder="-" />
                      ) : (
                        <span className="text-xs text-slate-600">{resp.score || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-500">{resp.notes || '-'}</td>
                    <td className="py-2">
                      {resp.is_selected ? (
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Awarded</span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                    {canCreate && bid.status !== 'Cancelled' && (
                      <td className="py-2">
                        {!resp.is_selected && bid.status !== 'Awarded' && (
                          <button onClick={() => handleAward(resp.id)}
                            className="text-[10px] px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">
                            Award to Vendor
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CommentsSection entityType="bid" entityId={bid.id} />
    </div>
  );
}
