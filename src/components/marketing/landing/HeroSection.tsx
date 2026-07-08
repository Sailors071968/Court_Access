import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Cpu, Scale, Shield, Gem, CheckCircle2, UserCheck } from 'lucide-react';
import { SPACING, TYPOGRAPHY } from '../../../constants/designTokens';
import { cn } from '../../../lib/utils';

const TRUST_CHIPS = [
  { icon: ShieldCheck, label: 'Evidence-Governed' },
  { icon: Cpu, label: 'AI-Powered' },
  { icon: Scale, label: 'Built for Justice' },
];

const HERO_STATS = [
  { icon: Shield, tile: 'ca-icon-gold text-gold-light', value: '94%', tag: 'HIGH', label: 'Case Strength', sub: 'Strong likelihood of favorable outcome' },
  { icon: Gem, tile: 'ca-icon-blue text-blue-300', value: '98%', tag: 'VERY HIGH', label: 'Evidence Confidence', sub: 'Based on 106 total evidentiary items' },
  { icon: CheckCircle2, tile: 'ca-icon-violet text-violet-300', value: '91%', tag: 'COMPREHENSIVE', label: 'Overall Completeness', sub: 'All critical areas addressed' },
  { icon: UserCheck, tile: 'ca-icon-emerald text-emerald-300', value: '1 Item', tag: 'REQUIRES REVIEW', label: 'Human Review', sub: 'Review recommended' },
];

export function HeroSection() {
  return (
    <section className="relative ca-gradient-hero overflow-hidden">
      <div className="absolute inset-0 opacity-[0.5] ca-grid-overlay" />

      <div className={cn('relative', SPACING.container, 'pt-14 pb-16 lg:pt-20 lg:pb-20')}>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="animate-fade-in">
            <h1 className={cn(TYPOGRAPHY.display, 'mb-6')}>
              Criminal Case{' '}
              <span className="ca-text-gradient-gold">Intelligence Platform</span>
            </h1>

            <p className={cn(TYPOGRAPHY.bodyLg, 'max-w-xl mb-8')}>
              AI-powered criminal litigation intelligence for attorneys, investigators,
              public defenders, prosecutors, and justice professionals.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 h-13 px-8 rounded-xl text-base font-semibold ca-gradient-gold text-navy shadow-gold hover:brightness-110 transition-all"
              >
                Start Free Trial
                <ArrowRight size={20} />
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center justify-center gap-2 h-13 px-8 rounded-xl text-base font-medium bg-white/5 hover:bg-white/10 text-white border border-white/15 backdrop-blur-sm transition-all"
              >
                View Platform
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {TRUST_CHIPS.map((chip) => (
                <div key={chip.label} className="flex items-center gap-2 text-sm text-slate-300">
                  <chip.icon size={16} className="text-gold-light" />
                  <span>{chip.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cinematic courthouse imagery panel */}
          <div className="animate-slide-up">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-elevated aspect-[4/3] bg-navy-900">
              <img
                src="/hero-courthouse.png"
                alt="Illuminated neoclassical courthouse at dusk"
                loading="eager"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Cinematic gradient overlays for depth + brand blend */}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-navy-900/20" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-navy-900/40" />
              <div className="absolute inset-0 ring-1 ring-inset ring-gold/10" />
            </div>
          </div>
        </div>

        {/* Intelligence stat cards — illustrative product preview (not real case data) */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Illustrative preview</span>
            <span className="h-px flex-1 bg-white/5" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="ca-panel p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.tile)}>
                    <stat.icon size={18} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white leading-none">{stat.value}</div>
                    <div className="text-[10px] font-semibold text-gold-light uppercase tracking-wide mt-1">{stat.tag}</div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-200">{stat.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
