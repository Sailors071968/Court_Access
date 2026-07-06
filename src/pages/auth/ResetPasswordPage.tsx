// ============================================
// Court Access — Reset Password Page
// ============================================

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scale } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json().catch(() => ({ error: 'Request failed' }));

      if (!res.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // No token in URL — show error
  if (!token && !submitted) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                <Scale className="text-white" size={24} />
              </div>
              <h1 className="text-3xl font-bold text-white">Court Access</h1>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid reset link</h2>
            <p className="text-gray-500 text-sm mb-6">This password reset link is invalid or has expired.</p>
            <Link to="/forgot-password" className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors inline-block">
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-white">Court Access</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {submitted ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Password reset!</h2>
              <p className="text-gray-500 text-sm mb-6">Your password has been successfully updated.</p>
              <Link to="/login" className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors inline-block">
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Set new password</h2>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-pass" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input id="new-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required autoComplete="new-password" />
                </div>
                <div>
                  <label htmlFor="confirm-new-pass" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                  <input id="confirm-new-pass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required autoComplete="new-password" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
