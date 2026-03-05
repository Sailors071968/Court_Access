// ============================================
// Court Access — Checkout Success Page
// Displayed after successful Stripe Checkout.
// ============================================

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scale, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

interface SessionStatus {
  status: string;
  paymentStatus: string;
  customerEmail: string;
  plan: string;
  amountTotal: number;
  currency: string;
}

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'Payment Successful — Court Access';

    if (sessionId) {
      fetch(`/api/stripe/session-status?session_id=${encodeURIComponent(sessionId)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch session status');
          return res.json();
        })
        .then((data) => {
          setSession(data);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const planLabel = session?.plan === 'team' ? 'Team' : 'Professional';
  const amountFormatted = session?.amountTotal
    ? `$${(session.amountTotal / 100).toFixed(2)}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Nav */}
      <nav className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center">
              <Scale className="text-amber-400" size={18} />
            </div>
            <span className="text-lg font-semibold text-slate-900 tracking-tight">Court Access</span>
          </Link>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-slate-400" size={48} />
              <p className="text-gray-500">Confirming your payment...</p>
            </div>
          ) : error ? (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Scale className="text-amber-600" size={32} />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Unable to Confirm Payment</h1>
              <p className="mt-3 text-gray-500">
                We couldn&apos;t verify your payment status. If you were charged, your subscription is still active.
                Please contact support or check your email for a confirmation receipt.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors"
                >
                  Back to Pricing <ArrowRight size={16} />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 border border-gray-200 text-slate-700 px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Go Home
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Payment Successful</h1>
              <p className="mt-3 text-gray-500">
                {session ? (
                  <>
                    Your <span className="font-semibold text-slate-700">{planLabel}</span> plan is now active.
                    {amountFormatted && (
                      <span className="block mt-1 text-sm">
                        Charged {amountFormatted}/{session.plan === 'team' ? 'month' : 'month'}
                      </span>
                    )}
                  </>
                ) : (
                  'Your subscription is now active. Welcome to Court Access.'
                )}
              </p>

              {session?.customerEmail && (
                <p className="mt-4 text-sm text-gray-400">
                  Confirmation sent to <span className="font-medium text-gray-600">{session.customerEmail}</span>
                </p>
              )}

              <div className="mt-8 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6">
                <h2 className="font-semibold text-slate-900 mb-4">What&apos;s next?</h2>
                <ul className="space-y-3 text-left">
                  <li className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                    <span>Create your account to access your dashboard</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                    <span>Upload your first document for AI-powered analysis</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                    <span>Review structured findings and export court-ready packets</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors"
                >
                  Create Account <ArrowRight size={16} />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 border border-gray-200 text-slate-700 px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
