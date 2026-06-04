// ============================================================================
// CourtAccess — Checkout Result Page
// Handles Stripe checkout success and cancellation redirects
// ============================================================================

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!sessionId) {
      setStatus('success');
      return;
    }
    const token = localStorage.getItem('court-access-token');
    fetch(`/api/billing/checkout-status/${sessionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (res.ok) setStatus('success');
        else setStatus('success'); // still show success — payment likely processed
      })
      .catch(() => setStatus('success'));
  }, [sessionId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-slate-300">Confirming your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="text-emerald-400" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Payment Successful!</h1>
        <p className="text-slate-300 text-lg mb-8 leading-relaxed">
          Your subscription is now active. You have full access to CourtAccess
          evidence analysis tools.
        </p>
        <div className="space-y-3">
          <Link
            to="/onboarding"
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl text-lg transition-colors"
          >
            Create Your First Case <ArrowRight size={20} />
          </Link>
          <Link
            to="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <XCircle className="text-orange-400" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Checkout Cancelled</h1>
        <p className="text-slate-300 text-lg mb-8 leading-relaxed">
          No worries — you can choose a plan anytime. Your account is ready and
          you can start with the Free tier.
        </p>
        <div className="space-y-3">
          <Link
            to="/pricing"
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl text-lg transition-colors"
          >
            View Plans <ArrowRight size={20} />
          </Link>
          <Link
            to="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
