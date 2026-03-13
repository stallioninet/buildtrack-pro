import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            <span className="text-blue-600">Build</span>Track Pro
          </h1>
        </div>

        {sent ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Check your email</h2>
            <p className="text-sm text-slate-500 mb-6">
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
            </p>
            <p className="text-xs text-slate-400 mb-4">
              For demo: check the server console for the reset link.
            </p>
            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800">Reset your password</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="you@buildtrack.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700">
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
