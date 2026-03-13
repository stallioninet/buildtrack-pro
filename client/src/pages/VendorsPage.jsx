import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import { showError, showWarning } from '../utils/toast';

const VENDOR_TYPES = ['Supplier', 'Contractor', 'Consultant', 'Transporter', 'Equipment', 'Other'];

export default function VendorsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const canCreate = ['owner', 'pm', 'procurement'].includes(user?.role);
  const canDelete = ['owner', 'pm'].includes(user?.role);

  const loadData = () => {
    if (!currentProject?.id) return;
    api.get(`/vendors?project_id=${currentProject.id}`)
      .then(setVendors).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentProject?.id]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this vendor?')) return;
    try {
      await api.delete(`/vendors/${id}`);
      loadData();
    } catch (err) { showError(err.message); }
  };

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
        {canCreate && (
          <button onClick={() => { setSelectedVendor(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + Add Vendor
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No vendors found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
                    onClick={() => { setSelectedVendor(vendor); setShowModal(true); }}>
                    {vendor.name}
                  </h3>
                  <p className="text-xs text-slate-500">{vendor.type || 'General'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={vendor.status} />
                  {canDelete && (
                    <button onClick={() => handleDelete(vendor.id)}
                      className="text-slate-400 hover:text-red-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">{vendor.phone || 'No phone'}</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star}
                      className={`w-3.5 h-3.5 ${star <= (vendor.rating || 0) ? 'text-yellow-400' : 'text-slate-200'}`}
                      fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <VendorModal
          vendor={selectedVendor}
          projectId={currentProject.id}
          onClose={() => { setShowModal(false); setSelectedVendor(null); }}
          onSaved={() => { setShowModal(false); setSelectedVendor(null); loadData(); }}
        />
      )}
    </div>
  );
}

function VendorModal({ vendor, projectId, onClose, onSaved }) {
  const isEdit = !!vendor;
  const [form, setForm] = useState({
    name: vendor?.name || '',
    type: vendor?.type || '',
    phone: vendor?.phone || '',
    rating: vendor?.rating || 0,
    status: vendor?.status || 'Active',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return showWarning('Name is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/vendors/${vendor.id}`, form);
      } else {
        await api.post('/vendors', { ...form, project_id: projectId });
      }
      onSaved();
    } catch (err) {
      showError(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
              placeholder="Vendor name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                <option value="">Select type</option>
                {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Phone</label>
              <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1"
                placeholder="Phone number" />
            </div>
          </div>
          {isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium">Rating</label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => set('rating', star)} type="button">
                      <svg className={`w-6 h-6 ${star <= form.rating ? 'text-yellow-400' : 'text-slate-200'}`}
                        fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Blacklisted">Blacklisted</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}
