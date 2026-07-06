import { Link } from 'react-router-dom';
import { ArrowRight, Layers, Search, Scale, Gavel, FileText } from 'lucide-react';
import { SPACING, TYPOGRAPHY } from '../../../constants/designTokens';
import { cn } from '../../../lib/utils';

export function HeroSection() {
  return (
    <section className="relative bg-navy overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] ca-grid-overlay" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gold/5 to-transparent pointer-events-none" />

      <div className={cn('relative', SPACING.container, 'pt-12 pb-20 lg:pt-20 lg:pb-28')}>
        <div className="text-center max-w-4xl mx-auto animate-fade-in">
          <p className={cn(TYPOGRAPHY.overline, 'text-gold-light mb-4')}>
            Criminal Case Intelligence Platform
          </p>

          <h1 className={cn(TYPOGRAPHY.display, 'text-white mb-6')}>
            Your Criminal Case May Have Defenses{' '}
            <span className="ca-text-gradient-gold">You Haven&apos;t Found Yet.</span>
          </h1>

          <p className={cn(TYPOGRAPHY.bodyLg, 'max-w-3xl mx-auto mb-10')}>
            CourtAccess helps organize, analyze, and connect the information in a
            criminal case to identify contradictions, evidence gaps, charge elements,
            jury instructions, legal authorities, and potentially relevant case issues.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-13 px-8 rounded-xl text-base font-semibold bg-gold-light hover:bg-gold text-navy shadow-gold hover:shadow-lg transition-all"
            >
              Start Free 30-Day Trial
              <ArrowRight size={20} />
            </Link>
            <a
              href="#intelligence"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-13 px-8 rounded-xl text-base font-medium bg-white/10 hover:bg-white/15 text-white border border-white/15 backdrop-blur-sm transition-all"
            >
              See How It Works
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {[
              { icon: Layers, label: 'Case Organization' },
              { icon: Search, label: 'Contradiction Analysis' },
              { icon: Scale, label: 'Charge & CALCRIM Mapping' },
              { icon: Gavel, label: 'Motion & Authority Research' },
              { icon: FileText, label: 'Intelligence Reports' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-slate-400 text-sm">
                <item.icon size={14} className="text-gold-light/80" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard preview mock */}
        <div className="mt-16 max-w-5xl mx-auto animate-slide-up">
          <div className="rounded-2xl border border-white/10 bg-navy-light/60 backdrop-blur-lg p-1 shadow-glass">
            <div className="rounded-xl bg-surface-muted p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                <span className="text-xs text-slate-400 ml-2">CourtAccess — Case Intelligence</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Active Cases', 'Contradictions', 'Evidence Gaps', 'Authorities'].map((label) => (
                  <div key={label} className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-card">
                    <div className="text-2xl font-bold text-navy">—</div>
                    <div className="text-xs text-slate-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="h-24 bg-white rounded-xl border border-slate-200/80 flex items-center justify-center text-sm text-slate-400">
                Live platform preview — connect your case to see intelligence
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
