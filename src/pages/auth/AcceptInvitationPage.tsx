// ============================================
// Program 2 — Accept Organization Invitation
// ============================================

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvitation, previewInvitation } from '../../services/organizationApi';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    previewInvitation(token)
      .then(setPreview)
      .catch(() => setError('Invalid or expired invitation'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await acceptInvitation(token, name, password);
      if (data.accessToken) localStorage.setItem('court-access-token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('court-access-refresh-token', data.refreshToken);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join organization');
    }
  };

  if (!token) {
    return <div className="p-8 text-center">Missing invitation token. <Link to="/login" className="text-gold-light">Sign in</Link></div>;
  }

  const org = preview?.organization as Record<string, unknown> | undefined;

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 rounded-2xl shadow-xl p-8">
        <h1 className="text-xl font-bold mb-2">Join {org?.name ? String(org.name) : 'your firm'}</h1>
        <p className="text-sm text-slate-300 mb-6">
          You&apos;ve been invited as <strong>{String(preview?.role ?? 'member')}</strong>
          {preview?.email ? <> for {String(preview.email)}</> : null}
        </p>
        {error && <div className="bg-red-500/10 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full border rounded-lg px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
          <input className="w-full border rounded-lg px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 characters)" minLength={8} required />
          <button type="submit" className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium">Create account & join</button>
        </form>
        <p className="text-center text-sm text-slate-400 mt-4">
          Already have an account? <Link to="/login" className="text-gold-light">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
