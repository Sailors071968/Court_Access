// ============================================
// Court Access — Email Verification Page
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scale } from 'lucide-react';

const API_BASE = '/api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const verify = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setStatus('success');
      setMessage(data.message || 'Email verified successfully.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
    }
  }, [token]);

  useEffect(() => {
    if (token && status === 'idle') {
      void verify();
    }
  }, [token, status, verify]);

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 rounded-2xl shadow-xl p-8 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <Scale className="text-amber-500" size={28} />
          <h1 className="text-xl font-semibold text-white">Verify your email</h1>
        </div>
        {status === 'idle' && (
          <>
            <p className="text-slate-300 mb-6">Confirm your Court Access account email address.</p>
            <button
              type="button"
              onClick={verify}
              className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700"
            >
              Verify email
            </button>
          </>
        )}
        {status === 'loading' && <p className="text-slate-300">Verifying…</p>}
        {status === 'success' && (
          <>
            <p className="text-green-700 mb-4">{message}</p>
            <Link to="/login" className="text-gold-light hover:underline">Sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-700 mb-4">{message}</p>
            <Link to="/login" className="text-gold-light hover:underline">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
