// ============================================
// Court Access — Login Page
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Scale, Eye, EyeOff } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Two-factor authentication</h2>
          <p className="text-sm text-gray-600 mb-6">Enter the 6-digit code from your authenticator app.</p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm tracking-widest text-center"
              placeholder="000000"
              autoComplete="one-time-code"
            />
            <button type="submit" disabled={isLoading} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium">
              {isLoading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-white">Court Access</h1>
          </div>
          <p className="text-slate-400">Criminal Evidence Intelligence Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@courtaccess.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign up
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
