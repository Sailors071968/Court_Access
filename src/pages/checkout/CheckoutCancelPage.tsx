// ============================================
// Court Access — Checkout Cancel Page
// Displayed when user cancels Stripe Checkout.
// ============================================

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, XCircle, ArrowLeft } from 'lucide-react';

export function CheckoutCancelPage() {
  useEffect(() => {
    document.title = 'Checkout Cancelled — Court Access';
  }, []);

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
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="text-gray-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Checkout Cancelled</h1>
          <p className="mt-3 text-gray-500">
            No worries — you haven&apos;t been charged. You can restart checkout anytime.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Pricing
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 border border-gray-200 text-slate-700 px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
