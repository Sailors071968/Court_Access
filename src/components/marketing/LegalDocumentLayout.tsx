// ============================================================================
// Legal document pages — Privacy, Terms, Disclaimer (Program 0)
// ============================================================================

import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

interface LegalDocumentLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalDocumentLayout({ title, lastUpdated, children }: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold text-white">CourtAccess</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-slate-400 hover:text-white transition-colors">Login</Link>
            <Link to="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">Sign Up</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{title}</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: {lastUpdated}</p>
        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
          {children}
        </div>
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-slate-400 hover:text-white">Privacy Policy</Link>
          <Link to="/terms" className="text-slate-400 hover:text-white">Terms of Service</Link>
          <Link to="/legal-disclaimer" className="text-slate-400 hover:text-white">Legal Disclaimer</Link>
          <Link to="/" className="text-amber-400 hover:text-amber-300">Return to Homepage</Link>
        </div>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-slate-400">{children}</div>
    </section>
  );
}
