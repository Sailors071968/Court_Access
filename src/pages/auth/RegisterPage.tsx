// ============================================
// Court Access — Register Page
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Scale, Tag, CheckCircle2, XCircle } from 'lucide-react';
import type { UserRole } from '../../types';

// ---------------------------------------------------------------------------
// Discount code validation via backend API
// ---------------------------------------------------------------------------

interface DiscountValidation {
  valid: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  codeName?: string;
  errorReason?: string;
}

async function validateDiscountCodeAPI(codeValue: string): Promise<DiscountValidation> {
  if (!codeValue.trim()) return { valid: false, errorReason: 'No code entered' };
  try {
    const res = await fetch(`/api/discount-codes/validate?code=${encodeURIComponent(codeValue.trim())}`);
    if (!res.ok) {
      return { valid: false, errorReason: 'Unable to validate discount code' };
    }
    return await res.json();
  } catch {
    return { valid: false, errorReason: 'Network error — unable to validate discount code' };
  }
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('attorney');
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState<DiscountValidation | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

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
    if (!termsAccepted || !privacyAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }
    try {
      await register(name, email, password, role, { termsAccepted, privacyAccepted });

      // Apply discount code via backend (deducts usage)
      if (discountCode.trim() && discountResult?.valid) {
        try {
          const token = localStorage.getItem('court-access-token');
          await fetch('/api/discount-codes/apply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ code: discountCode.trim() }),
          });
        } catch {
          // Non-critical — discount was validated, apply failure is logged server-side
        }
      }

      navigate('/pricing');
    } catch {
      setError('Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-white">Court Access</h1>
          </div>
          <p className="text-slate-400">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Doe" required />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@courtaccess.com" required />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="attorney">Attorney</option>
                <option value="investigator">Investigator</option>
                <option value="staff">Staff</option>
                <option value="defendant">Defendant</option>
              </select>
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Minimum 8 characters" required autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Re-enter password" required autoComplete="new-password" />
            </div>
            {/* Phase 223: Discount code field */}
            <div>
              <label htmlFor="discount-code" className="block text-sm font-medium text-gray-700 mb-1">Discount code <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="text-gray-400" size={14} />
                  </div>
                  <input
                    id="discount-code"
                    type="text"
                    value={discountCode}
                    onChange={(e) => { setDiscountCode(e.target.value); setDiscountResult(null); }}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                    placeholder="e.g. EARLYACCESS50"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setValidatingDiscount(true);
                    const result = await validateDiscountCodeAPI(discountCode);
                    setDiscountResult(result);
                    setValidatingDiscount(false);
                  }}
                  disabled={!discountCode.trim() || validatingDiscount}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  {validatingDiscount ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {discountResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${discountResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {discountResult.valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>
                    {discountResult.valid
                      ? `${discountResult.codeName} — ${discountResult.discountType === 'fixed' ? `$${discountResult.discountValue}` : `${discountResult.discountValue}%`} discount applied`
                      : discountResult.errorReason}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="flex items-start gap-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  required
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-amber-600 hover:underline">Terms of Service</Link>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  required
                />
                <span>
                  I agree to the{' '}
                  <Link to="/privacy" target="_blank" className="text-amber-600 hover:underline">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <button type="submit" disabled={isLoading || !termsAccepted || !privacyAccepted} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50">
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
