// ============================================================================
// Program 94 — Demonstration shell: persistent ILLUSTRATIVE EXAMPLE labeling.
// Every demonstration page is wrapped so a visitor can never confuse it with
// production data. Public / read-only / no authentication.
// ============================================================================

import { Link } from 'react-router-dom';
import { Scale, AlertTriangle, ArrowLeft } from 'lucide-react';

export function DemoBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`w-full bg-amber-500/15 border-y border-amber-500/40 ${compact ? 'py-1.5' : 'py-2.5'} px-4`}>
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 text-center flex-wrap">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-xs md:text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Illustrative Example</span>
        <span className="text-amber-500/60">·</span>
        <span className="text-xs md:text-sm font-semibold uppercase tracking-wide text-amber-200/90">Demonstration Only</span>
        <span className="text-amber-500/60">·</span>
        <span className="text-xs md:text-sm font-semibold uppercase tracking-wide text-amber-200/90">Not Actual Case Information</span>
      </div>
    </div>
  );
}

export function DemoWatermark() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden print:hidden">
      <span className="text-[10vw] font-black uppercase tracking-widest text-amber-400/[0.04] rotate-[-24deg] select-none whitespace-nowrap">
        Illustrative Example · Demonstration Only
      </span>
    </div>
  );
}

export function DemoShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-navy-800 text-slate-100 relative">
      {/* Sticky top banner */}
      <div className="sticky top-0 z-40">
        <DemoBanner />
      </div>

      {/* Public demo header */}
      <header className="border-b border-white/10 bg-navy-900/60 backdrop-blur relative z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/demo" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg ca-gradient-gold flex items-center justify-center text-navy"><Scale className="w-4 h-4" /></span>
            <span className="font-bold tracking-tight">CourtAccess <span className="text-gold-light">Demo</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-sm text-slate-300 hover:text-gold-light inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Home</Link>
            <Link to="/register" className="text-sm font-semibold px-3 py-1.5 rounded-lg ca-gradient-gold text-navy hover:opacity-90">Get started</Link>
          </div>
        </div>
      </header>

      <DemoWatermark />

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {title && <p className="ca-overline mb-2">{title}</p>}
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/10 mt-12 py-6 text-center">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Illustrative Example · Demonstration Only · Not Actual Case Information</p>
          <p className="text-xs text-slate-500 mt-2">All names, case numbers, facts, and data shown are fictional and created solely to demonstrate CourtAccess capabilities. Not legal advice.</p>
        </div>
      </footer>
    </div>
  );
}
