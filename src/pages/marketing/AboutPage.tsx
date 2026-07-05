// ============================================================================
// About Page — Program 0 Production Website
// ============================================================================

import { Link } from 'react-router-dom';
import { Scale, Shield, Users, MapPin, ArrowRight } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

export function AboutPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            About CourtAccess
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
            CourtAccess is an evidence-governed California criminal litigation platform
            built for attorneys, investigators, defendants, and their authorized teams.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Every criminal case contains more information than any single person can
                organize, connect, and analyze. CourtAccess brings case documents, evidence,
                timelines, legal authorities, and investigative intelligence into one secure
                platform — so defense teams can find contradictions, gaps, and defenses faster.
              </p>
              <p className="text-slate-600 leading-relaxed">
                We believe every subscriber deserves the complete platform. Access restrictions
                apply only to organizations, cases, and delegated permissions — never to
                core legal intelligence capabilities.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                { icon: Scale, title: 'Evidence-Governed', desc: 'Immutable originals, auditable changes, chain of custody.' },
                { icon: Shield, title: 'Security First', desc: 'Tenant isolation, MFA, delegated access, non-disclosure by design.' },
                { icon: MapPin, title: 'California Focus', desc: 'CALCRIM, California statutes, CPRA policy intelligence.' },
                { icon: Users, title: 'Team Collaboration', desc: 'Attorneys, investigators, clients, and experts on one case.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Who We Serve</h2>
          <p className="text-slate-600 max-w-2xl mx-auto mb-8">
            Criminal defense attorneys, private investigators, defendants managing their own
            cases, public defenders, and authorized family members — all through one universal
            subscription with permission-based access.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Start Free 30-Day Trial
              <ArrowRight size={18} />
            </Link>
            <Link to="/contact" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Contact Enterprise Sales
            </Link>
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
