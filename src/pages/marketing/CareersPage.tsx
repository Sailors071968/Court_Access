// ============================================================================
// Careers Page — Program 1 v18.0
// ============================================================================

import { Link } from 'react-router-dom';
import { Briefcase, MapPin, ArrowRight, Shield } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const OPEN_ROLES = [
  {
    title: 'Senior Full-Stack Engineer',
    location: 'Remote (US)',
    department: 'Engineering',
    description: 'Build evidence-governed litigation workflows, permission engines, and production systems at scale.',
  },
  {
    title: 'California Legal Intelligence Engineer',
    location: 'Remote (US)',
    department: 'Legal Technology',
    description: 'Expand legislative intelligence pipeline — offense discovery, CALCRIM mapping, knowledge graph integrity.',
  },
  {
    title: 'Product Designer — Litigation UX',
    location: 'Remote (US)',
    department: 'Product',
    description: 'Design attorney-first workflows grounded in evidence, auditability, and the UI Constitution.',
  },
];

const VALUES = [
  { title: 'Evidence Before Decoration', desc: 'Every UI decision serves litigation integrity.' },
  { title: 'No Fabrication', desc: 'UNKNOWN is always preferable to invented conclusions.' },
  { title: 'Production Quality', desc: 'No prototypes in production. Every workflow must be complete.' },
];

export function CareersPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <Briefcase className="text-amber-400" size={16} />
            <span className="text-amber-300 text-sm font-medium">Careers</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Build the Future of Criminal Litigation
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Join CourtAccess and help build the operating system for California criminal litigation.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Open Positions</h2>
          <div className="space-y-6">
            {OPEN_ROLES.map((role) => (
              <div key={role.title} className="p-6 rounded-xl border border-slate-200 bg-white hover:border-amber-200 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{role.title}</h3>
                    <p className="text-sm text-amber-600 font-medium mt-1">{role.department}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-2">
                      <MapPin size={14} />
                      {role.location}
                    </p>
                    <p className="text-slate-600 mt-3 text-sm leading-relaxed">{role.description}</p>
                  </div>
                  <a
                    href={`mailto:careers@courtaccess.net?subject=Application: ${encodeURIComponent(role.title)}`}
                    className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:text-amber-500"
                  >
                    Apply
                    <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Engineering Principles</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {VALUES.map(({ title, desc }) => (
              <div key={title} className="p-5 rounded-xl bg-white border border-slate-200 text-center">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield className="text-amber-600" size={20} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2 text-sm">{title}</h3>
                <p className="text-xs text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 text-center">
        <p className="text-slate-600 mb-4">Don't see your role? We're always looking for exceptional talent.</p>
        <a href="mailto:careers@courtaccess.net" className="text-amber-600 hover:text-amber-500 font-semibold">
          careers@courtaccess.net
        </a>
        <div className="mt-6">
          <Link to="/about" className="text-sm text-slate-500 hover:text-slate-700">Learn about CourtAccess →</Link>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
