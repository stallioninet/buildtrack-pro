import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'owner@buildtrack.com', role: 'Home Owner', color: 'bg-purple-100 text-purple-700' },
  { email: 'firm@buildtrack.com', role: 'Construction Firm', color: 'bg-violet-100 text-violet-700' },
  { email: 'pm@buildtrack.com', role: 'Project Manager', color: 'bg-blue-100 text-blue-700' },
  { email: 'engineer@buildtrack.com', role: 'Site Engineer', color: 'bg-green-100 text-green-700' },
  { email: 'contractor@buildtrack.com', role: 'Contractor', color: 'bg-orange-100 text-orange-700' },
  { email: 'procurement@buildtrack.com', role: 'Procurement', color: 'bg-teal-100 text-teal-700' },
  { email: 'accounts@buildtrack.com', role: 'Accounts', color: 'bg-indigo-100 text-indigo-700' },
  { email: 'inspector@buildtrack.com', role: 'Quality Inspector', color: 'bg-red-100 text-red-700' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
    setLoading(true);
    try {
      await login(demoEmail, 'password123');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Gradient panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex-col justify-center px-16">
        <h1 className="text-4xl font-bold leading-tight">
          BuildTrack Pro
        </h1>
        <p className="mt-4 text-xl text-blue-100">
          Innovative Home Construction Management System
        </p>
        <div className="mt-10 space-y-4">
          {[
            'Real-time project tracking with stage-level visibility',
            'SP 62:1997 quality checklists for Indian construction standards',
            'State machine workflows for approvals and inspections',
            'Role-based dashboards for all stakeholders',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 text-blue-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-blue-100">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <h1 className="text-2xl font-bold text-slate-800">
              <span className="text-blue-600">Build</span>Track Pro
            </h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-800">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Enter your credentials to access the dashboard</p>

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="you@buildtrack.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Quick Demo Login</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => handleDemoLogin(acc.email)}
                  disabled={loading}
                  className={`px-3 py-2 rounded-lg text-xs font-medium ${acc.color} hover:opacity-80 transition disabled:opacity-50`}
                >
                  {acc.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
