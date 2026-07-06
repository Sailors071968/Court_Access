// ============================================================================
// Reusable audience persona marketing page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';
import type { PersonaConfig } from './personaConfigs';

interface PersonaMarketingPageProps {
  config: PersonaConfig;
}

export function PersonaMarketingPage({ config }: PersonaMarketingPageProps) {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-amber-300 text-sm font-medium">{config.badge}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            {config.title}{' '}
            <span className="text-amber-400">{config.highlight}</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
            {config.subtitle}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Start Free 30-Day Trial
              <ArrowRight size={18} />
            </Link>
            <Link to="/how-it-works" className="text-slate-400 hover:text-white font-medium transition-colors">
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {config.features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="text-amber-600" size={20} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Universal Platform Access</h2>
          <p className="text-slate-600 mb-6">
            Every subscriber receives the complete CourtAccess platform. Only billing differs — no feature tiers, no artificial restrictions.
          </p>
          <ul className="text-left max-w-md mx-auto space-y-2 mb-8">
            {['Full case intelligence', 'All command centers', 'Up to 5 delegated users', 'Evidence-governed workflows'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-slate-700 text-sm">
                <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                {item}
              </li>
            ))}
          </ul>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-500 font-semibold transition-colors"
          >
            View Pricing
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
