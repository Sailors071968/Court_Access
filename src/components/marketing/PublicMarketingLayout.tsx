// ============================================================================
// Public marketing site layout — shared nav + footer (Program 0)
// ============================================================================

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail } from 'lucide-react';

const NAV_LINKS = [
  { href: '/features', label: 'Features', isRoute: true },
  { href: '/pricing', label: 'Pricing', isRoute: true },
  { href: '/about', label: 'About', isRoute: true },
  { href: '/faq', label: 'FAQ', isRoute: true },
  { href: '/contact', label: 'Contact', isRoute: true },
] as const;

export function PublicMarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">CourtAccess</span>
          </Link>

          <div className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((item) =>
              item.isRoute ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {item.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-400 hover:text-white font-medium transition-colors hidden sm:inline"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-white/10 pt-4 space-y-3">
            {NAV_LINKS.map((item) =>
              item.isRoute ? (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-slate-300 hover:text-white py-1"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-slate-300 hover:text-white py-1"
                >
                  {item.label}
                </a>
              ),
            )}
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">
              Login
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export function PublicMarketingFooter() {
  return (
    <footer className="bg-[#0f172a] border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
                <Shield className="text-white" size={18} />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CourtAccess</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Criminal Case Intelligence Platform
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/faq" className="text-sm text-slate-400 hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-sm text-slate-400 hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Login</Link></li>
              <li><Link to="/register" className="text-sm text-slate-400 hover:text-white transition-colors">Free Trial</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/legal-disclaimer" className="text-sm text-slate-400 hover:text-white transition-colors">Legal Disclaimer</Link></li>
              <li>
                <a href="mailto:support@courtaccess.net" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                  <Mail size={14} />
                  support@courtaccess.net
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} CourtAccess. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">Criminal Case Intelligence Platform</p>
        </div>
      </div>
    </footer>
  );
}

interface PublicMarketingLayoutProps {
  children: ReactNode;
  className?: string;
}

export function PublicMarketingLayout({ children, className = 'bg-white' }: PublicMarketingLayoutProps) {
  return (
    <div className={`min-h-screen ${className}`}>
      <PublicMarketingNav />
      <main className="pt-20">{children}</main>
      <PublicMarketingFooter />
    </div>
  );
}
