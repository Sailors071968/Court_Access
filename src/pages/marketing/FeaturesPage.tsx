// ============================================================================
// Features Page — Program 0 Production Website
// ============================================================================

import { Link } from 'react-router-dom';
import {
  FileText, Search, Shield, Eye, Users, Briefcase, BarChart3,
  Scale, BookOpen, Gavel, Layers, Link2, HardDrive, ArrowRight,
} from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const FEATURE_GROUPS = [
  {
    title: 'Case Intelligence',
    description: 'Organize and connect every element of a criminal case.',
    features: [
      { icon: Layers, name: 'Case Organization', desc: 'Charges, hearings, motions, discovery, and deadlines in one workspace.' },
      { icon: BarChart3, name: 'Timeline Analysis', desc: 'Reconstruct events and identify temporal contradictions.' },
      { icon: Search, name: 'Contradiction Detection', desc: 'Surface inconsistencies across witness statements and reports.' },
      { icon: Eye, name: 'Evidence Gap Analysis', desc: 'Identify missing evidence and unknowns in the prosecution narrative.' },
    ],
  },
  {
    title: 'Legal Analysis',
    description: 'California criminal law intelligence at your fingertips.',
    features: [
      { icon: Scale, name: 'Element Analysis', desc: 'Map evidence to charge elements and mens rea requirements.' },
      { icon: BookOpen, name: 'Authority Explorer', desc: 'Case law, statutes, and legal authorities linked to your charges.' },
      { icon: Gavel, name: 'CALCRIM Explorer', desc: 'Jury instructions matched to charges with element breakdowns.' },
      { icon: Link2, name: 'Knowledge Graph', desc: 'Relationships among code, offenses, elements, and evidence.' },
    ],
  },
  {
    title: 'Evidence Platform',
    description: 'Enterprise-grade evidence management and review.',
    features: [
      { icon: HardDrive, name: 'Evidence Repository', desc: 'Upload, OCR, deduplicate, version, and search all case evidence.' },
      { icon: FileText, name: 'Document Redaction', desc: 'Create controlled publication versions while preserving originals.' },
      { icon: Shield, name: 'Chain of Custody', desc: 'Immutable originals with full audit trail.' },
      { icon: Eye, name: 'Controlled Disclosure', desc: 'Share redacted versions per recipient with non-disclosure.' },
    ],
  },
  {
    title: 'Professional Workbenches',
    description: 'Purpose-built tools for every role on the defense team.',
    features: [
      { icon: Briefcase, name: 'Attorney Workbench', desc: 'Motions, trial notebook, voir dire, opening and closing outlines.' },
      { icon: Search, name: 'Investigator Workbench', desc: 'Witnesses, leads, interviews, field notes, and surveillance logs.' },
      { icon: Users, name: 'Client Portal', desc: 'Court dates, documents, messages, and authorized evidence uploads.' },
      { icon: Users, name: 'Delegated Access', desc: 'Invite up to five users with per-case, per-resource permissions.' },
    ],
  },
];

export function FeaturesPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Platform Features
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            One complete platform for every subscriber. Authorization is determined by
            delegated permissions — not subscription tier.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{group.title}</h2>
                <p className="text-slate-600">{group.description}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                {group.features.map(({ icon: Icon, name, desc }) => (
                  <div key={name} className="p-6 rounded-xl border border-slate-200 hover:border-amber-200 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="text-amber-600" size={20} />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-2">{name}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Ready to explore?</h2>
          <p className="text-slate-600 mb-8">Start your free 30-day trial — full platform access, no credit card required.</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Start Free Trial
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
