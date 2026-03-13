import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/navigation';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');

  // Handle URL query param for tab navigation (e.g., /profile?tab=notifications)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab === 'notifications' || urlTab === 'password' || urlTab === 'profile') {
      setTab(urlTab);
    }
  }, []);

  // Scroll to notifications section when tab is set via URL
  useEffect(() => {
    if (tab === 'notifications') {
      setTimeout(() => {
        document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [tab]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profile & Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account details and password</p>
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white">
            {user?.avatarCode || user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{user?.name}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {user?.roleDisplayName || ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setTab('profile')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'profile' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Profile Details
        </button>
        <button
          onClick={() => setTab('password')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'password' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Change Password
        </button>
        <button
          onClick={() => setTab('notifications')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'notifications' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Notifications
        </button>
      </div>

      {tab === 'profile' && <ProfileForm user={user} onUpdated={refreshUser} />}
      {tab === 'password' && <PasswordForm />}
      {tab === 'notifications' && <NotificationPreferences />}
    </div>
  );
}

function NotificationPreferences() {
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/notifications/preferences').then(setNotifPrefs).catch(() => {
      setError('Failed to load notification preferences.');
    });
  }, []);

  const handlePrefToggle = async (field) => {
    if (!notifPrefs) return;
    const newValue = notifPrefs[field] ? 0 : 1;
    setSavingPrefs(true);
    setError(null);
    try {
      const updated = await api.patch('/notifications/preferences', { [field]: newValue });
      setNotifPrefs(updated);
    } catch (e) {
      setError('Failed to update preference');
    }
    setSavingPrefs(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6" id="notifications">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Notification Preferences</h2>
      <p className="text-sm text-slate-500 mb-4">Choose which notifications you want to receive.</p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {notifPrefs ? (
        <div className="space-y-3">
          {[
            { key: 'task_assigned', label: 'Task assignments', desc: 'When a task is assigned to you' },
            { key: 'status_change', label: 'Status changes', desc: 'When entities change status in your projects' },
            { key: 'comment', label: 'Comments', desc: 'When someone comments on entities you\'re involved with' },
            { key: 'ncr_escalation', label: 'NCR escalations', desc: 'When Critical or Major NCRs are raised' },
            { key: 'rfi_due_soon', label: 'RFI due dates', desc: 'When RFIs assigned to you are approaching their due date' },
            { key: 'document_approval', label: 'Document approvals', desc: 'When documents are approved or rejected' },
            { key: 'safety_alert', label: 'Safety alerts', desc: 'When safety incidents or permits are reported' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <button
                onClick={() => handlePrefToggle(key)}
                disabled={savingPrefs}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notifPrefs[key] ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${notifPrefs[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          ))}
        </div>
      ) : !error ? (
        <p className="text-sm text-slate-400">Loading preferences...</p>
      ) : null}
    </div>
  );
}

function ProfileForm({ user, onUpdated }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.patch('/auth/profile', {
        name: form.name,
        phone: form.phone || null,
      });
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      if (onUpdated) onUpdated();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = form.name !== (user?.name || '') || form.phone !== (user?.phone || '');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">Edit Profile</h3>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="e.g. +91 98765 43210"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
          <input
            type="text"
            value={user?.roleDisplayName || ROLE_LABELS[user?.role] || user?.role || ''}
            disabled
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">Role is managed by the project owner.</p>
        </div>

        {user?.created_at && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Member Since</label>
            <input
              type="text"
              value={new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (form.new_password !== form.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (form.new_password.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setMessage({ type: 'success', text: 'Password changed successfully.' });
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.current_password && form.new_password && form.confirm_password;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">Change Password</h3>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
          <input
            type="password"
            required
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
          <input
            type="password"
            required
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            placeholder="Minimum 8 characters"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
          <input
            type="password"
            required
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {form.confirm_password && form.new_password !== form.confirm_password && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
