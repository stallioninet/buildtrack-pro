import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-slate-500 mb-6">This link is missing the reset token. Please request a new password reset.</p>
          <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            <span className="text-blue-600">Build</span>Track Pro
          </h1>
        </div>

        {success ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Password Reset!</h2>
            <p className="text-sm text-slate-500 mb-6">Your password has been reset successfully. You can now sign in with your new password.</p>
            <Link to="/login" className="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
              Sign In
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800">Set new password</h2>
            <p className="mt-2 text-sm text-slate-500">Enter your new password below.</p>

            {error && (
              <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Re-enter your password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
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
