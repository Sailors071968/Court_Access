// ============================================
// Court Access — Register Page (Program 2A)
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Scale, Tag, CheckCircle2, XCircle } from 'lucide-react';
import { REGISTRATION_ROLE_OPTIONS, FUTURE_REGISTRATION_ROLES, type DefaultRole } from '../../config/roleOnboarding';

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
  const [defaultRole, setDefaultRole] = useState<DefaultRole>('attorney');
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState<DiscountValidation | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const selectedRole = REGISTRATION_ROLE_OPTIONS.find((r) => r.value === defaultRole);

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
      const result = await register(name, email, password, defaultRole, { termsAccepted, privacyAccepted });

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
          /* non-critical */
        }
      }

      const nextRoute = result?.onboarding?.postRegistrationRoute ?? '/onboarding';
      navigate(nextRoute);
    } catch {
      setError('Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 ca-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
              <Scale className="text-navy" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-white">Court<span className="text-gold-light">Access</span></h1>
          </div>
          <p className="text-slate-400">Create your account — full platform access for every subscriber</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl p-8 backdrop-blur-sm">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Full name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light" placeholder="Jane Doe" required />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-300 mb-1">Email address</label>
              <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light" placeholder="you@courtaccess.com" required />
            </div>
            <div>
              <label htmlFor="defaultRole" className="block text-sm font-medium text-slate-300 mb-1">
                Your role
              </label>
              <select
                id="defaultRole"
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as DefaultRole)}
                className="w-full px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light bg-white"
              >
                {REGISTRATION_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {FUTURE_REGISTRATION_ROLES.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled>{opt.label}</option>
                ))}
              </select>
              {selectedRole && (
                <p className="mt-1.5 text-xs text-slate-400">{selectedRole.description}</p>
              )}
              <p className="mt-1 text-xs text-gold-light">
                Your role configures your dashboard and onboarding — it does not limit platform capabilities.
              </p>
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light" placeholder="Minimum 8 characters" required autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-1">Confirm password</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light" placeholder="Re-enter password" required autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="discount-code" className="block text-sm font-medium text-slate-300 mb-1">Discount code <span className="text-slate-500 font-normal">(optional)</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="text-slate-500" size={14} />
                  </div>
                  <input
                    id="discount-code"
                    type="text"
                    value={discountCode}
                    onChange={(e) => { setDiscountCode(e.target.value); setDiscountResult(null); }}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light uppercase"
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
                  className="px-4 py-2.5 rounded-lg border border-white/15 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  {validatingDiscount ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {discountResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${discountResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {discountResult.valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>
                    {discountResult.valid
                      ? `${discountResult.codeName} — ${discountResult.discountType === 'fixed' ? `$${discountResult.discountValue}` : `${discountResult.discountValue}%`} discount applied`
                      : discountResult.errorReason}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="flex items-start gap-3 text-sm text-slate-400">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 rounded border-white/20 bg-white/5 text-gold focus:ring-gold-light" required />
                <span>I agree to the <Link to="/terms" target="_blank" className="text-gold-light hover:underline">Terms of Service</Link></span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-400">
                <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} className="mt-1 rounded border-white/20 bg-white/5 text-gold focus:ring-gold-light" required />
                <span>I agree to the <Link to="/privacy" target="_blank" className="text-gold-light hover:underline">Privacy Policy</Link></span>
              </label>
            </div>

            <button type="submit" disabled={isLoading || !termsAccepted || !privacyAccepted} className="w-full ca-gradient-gold text-navy py-2.5 rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50">
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account? <Link to="/login" className="text-gold-light hover:text-gold-bright font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
