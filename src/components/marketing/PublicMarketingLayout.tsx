// ============================================================================
// Public marketing site layout — unified dark nav + footer (Programs 2–4)
// ============================================================================

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { BrandLogo } from '../brand/BrandLogo';
import { TrustBar } from '../brand/TrustBar';
import { PUBLIC_NAV_LINKS, PUBLIC_FOOTER_SECTIONS } from '../../config/navigation';
import { cn } from '../../lib/utils';

export function PublicMarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 ca-glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <BrandLogo variant="light" />

          <div className="hidden lg:flex items-center gap-6">
            {PUBLIC_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white font-medium transition-colors hidden sm:inline"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="text-sm ca-gradient-gold text-navy font-semibold px-5 py-2 rounded-xl transition-all hover:brightness-110 shadow-gold"
            >
              Start Free Trial
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
            {PUBLIC_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-slate-300 hover:text-white py-1"
              >
                {item.label}
              </Link>
            ))}
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">
              Log In
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function FooterLinkList({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
      <ul className="space-y-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link to={item.href} className="text-sm text-slate-400 hover:text-gold-light transition-colors">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicMarketingFooter() {
  return (
    <footer className="bg-navy-900 border-t border-white/5 pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <BrandLogo variant="light" className="mb-4" linkTo="/" />
            <p className="text-slate-400 text-sm leading-relaxed">
              AI-powered criminal case intelligence for justice professionals.
            </p>
          </div>
          <FooterLinkList title="Product" links={PUBLIC_FOOTER_SECTIONS.product} />
          <FooterLinkList title="Audiences" links={PUBLIC_FOOTER_SECTIONS.audiences} />
          <FooterLinkList title="Company" links={PUBLIC_FOOTER_SECTIONS.company} />
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              {PUBLIC_FOOTER_SECTIONS.legal.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className="text-sm text-slate-400 hover:text-gold-light transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:support@courtaccess.net"
                  className="text-sm text-slate-400 hover:text-gold-light transition-colors flex items-center gap-2"
                >
                  <Mail size={14} />
                  support@courtaccess.net
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Constitutional trust bar */}
      <TrustBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} CourtAccess. All rights reserved.</p>
        <p className="text-xs text-slate-300">Criminal Case Intelligence Platform</p>
      </div>
    </footer>
  );
}

interface PublicMarketingLayoutProps {
  children: ReactNode;
  className?: string;
}

export function PublicMarketingLayout({ children, className = 'bg-navy-800' }: PublicMarketingLayoutProps) {
  return (
    <div className={cn('min-h-screen', className)}>
      <PublicMarketingNav />
      <main className="pt-[68px]">{children}</main>
      <PublicMarketingFooter />
    </div>
  );
}
