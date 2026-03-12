// ============================================
// Court Access — Register Page
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Scale, Tag, CheckCircle2, XCircle } from 'lucide-react';
import type { UserRole } from '../../types';

// ---------------------------------------------------------------------------
// Phase 223: Discount code validation (localStorage-based, mirrors backend)
// ---------------------------------------------------------------------------

interface DiscountValidation {
  valid: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  codeName?: string;
  errorReason?: string;
}

function validateDiscountCodeClient(codeValue: string): DiscountValidation {
  if (!codeValue.trim()) return { valid: false, errorReason: 'No code entered' };
  const codes = JSON.parse(localStorage.getItem('courtaccess_discount_codes') || '[]');
  const code = codes.find(
    (c: { codeValue: string }) => c.codeValue.toUpperCase() === codeValue.trim().toUpperCase()
  );
  if (!code) return { valid: false, errorReason: 'Invalid discount code' };
  if (!code.active) return { valid: false, errorReason: 'This code is no longer active' };
  if (code.usageLimit !== null && code.usageCount >= code.usageLimit)
    return { valid: false, errorReason: 'This code has reached its usage limit' };
  if (code.expiresAt && new Date(code.expiresAt) < new Date())
    return { valid: false, errorReason: 'This code has expired' };
  return {
    valid: true,
    discountType: code.discountType,
    discountValue: code.discountValue,
    codeName: code.codeName,
  };
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('attorney');
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState<DiscountValidation | null>(null);
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
    try {
      await register(name, email, password, role);

      // Phase 223: Store applied discount code on user record
      if (discountCode.trim() && discountResult?.valid) {
        const codes = JSON.parse(localStorage.getItem('courtaccess_discount_codes') || '[]');
        const idx = codes.findIndex(
          (c: { codeValue: string }) => c.codeValue.toUpperCase() === discountCode.trim().toUpperCase()
        );
        if (idx !== -1) {
          codes[idx].usageCount = (codes[idx].usageCount || 0) + 1;
          localStorage.setItem('courtaccess_discount_codes', JSON.stringify(codes));
        }
        // Record usage
        const usages = JSON.parse(localStorage.getItem('courtaccess_discount_usages') || '[]');
        usages.push({
          usageId: crypto.randomUUID(),
          discountCodeId: codes[idx]?.codeId || '',
          userId: email,
          usedAt: new Date().toISOString(),
        });
        localStorage.setItem('courtaccess_discount_usages', JSON.stringify(usages));
        // Store on user
        localStorage.setItem('courtaccess_user_discount', JSON.stringify({
          email,
          appliedDiscountCode: discountCode.trim().toUpperCase(),
          discountPercentage: discountResult.discountValue,
          discountType: discountResult.discountType,
        }));
      }

      navigate('/dashboard');
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
                  onClick={() => setDiscountResult(validateDiscountCodeClient(discountCode))}
                  disabled={!discountCode.trim()}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
              {discountResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${discountResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {discountResult.valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>
                    {discountResult.valid
                      ? `${discountResult.codeName} — ${discountResult.discountValue}% discount applied`
                      : discountResult.errorReason}
                  </span>
                </div>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50">
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
