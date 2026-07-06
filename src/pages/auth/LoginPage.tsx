// ============================================
// Court Access — Login Page
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { TrustBar } from '../../components/brand/TrustBar';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const { login, completeMfaLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      const result = await login(email, password);
      if (result.mfaRequired && result.mfaSessionToken) {
        setMfaSessionToken(result.mfaSessionToken);
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!mfaSessionToken || !mfaCode) {
      setError('Enter your authenticator code.');
      return;
    }
    try {
      await completeMfaLogin(mfaSessionToken, mfaCode);
      navigate('/dashboard');
    } catch {
      setError('Invalid MFA code. Please try again.');
    }
  };

  if (mfaSessionToken) {
    return (
      <div className="min-h-screen ca-gradient-hero flex items-center justify-center px-4">
        <div className="w-full max-w-md ca-panel p-8">
          <h2 className="text-xl font-semibold text-white mb-2">Two-factor authentication</h2>
          <p className="text-sm text-slate-400 mb-6">Enter the 6-digit code from your authenticator app.</p>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-navy-900/60 text-white text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder="000000"
              autoComplete="one-time-code"
            />
            <button type="submit" disabled={isLoading} className="w-full ca-gradient-gold text-navy py-2.5 rounded-lg font-semibold hover:brightness-110 transition-all">
              {isLoading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ca-gradient-hero flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <BrandLogo variant="light" size="lg" linkTo="/" />
          </div>

          {/* Login Card */}
          <div className="ca-panel p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-navy-900/60 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
                  placeholder="you@courtaccess.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-navy-900/60 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 pr-10"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-white/20 bg-navy-900" />
                  <span className="text-slate-400">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-gold-light hover:text-gold-bright font-medium">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full ca-gradient-gold text-navy py-2.5 rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-gold-light hover:text-gold-bright font-medium">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
      <TrustBar />
    </div>
  );
}
