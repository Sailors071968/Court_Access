// ============================================
// Court Access — Signup Page (Conversion-Optimized)
// Clean legal-tech aesthetic, connects to POST /auth/register
// ============================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Scale, Eye, EyeOff, CheckCircle, ArrowRight } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    trackEvent('signup_start');
    document.title = 'Create Account — Court Access';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await register(name, email, password, 'attorney');
      trackEvent('signup_complete', { method: 'email' });
      navigate('/app/dashboard');
    } catch {
      setError('Registration failed. Please try again.');
    }
  };

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
          <div className="text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-slate-800 font-medium hover:underline">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Create your account</h1>
            <p className="mt-2 text-gray-500">Start with a free document analysis. No credit card required.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-shadow"
                  placeholder="Jane Doe"
                  required
                  autoComplete="name"
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-shadow"
                  placeholder="you@lawfirm.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent pr-10 transition-shadow"
                    placeholder="Minimum 8 characters"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="signup-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm password
                </label>
                <input
                  id="signup-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-shadow"
                  placeholder="Re-enter password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  'Creating account...'
                ) : (
                  <>
                    Start Free Analysis
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-xs text-gray-400 text-center">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="underline hover:text-gray-600">Terms of Service</Link>{' '}
              and{' '}
              <Link to="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
            </p>
          </div>

          {/* Trust signals */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-500" />
              No credit card required
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-500" />
              1 free document analysis
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-500" />
              256-bit encryption
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
