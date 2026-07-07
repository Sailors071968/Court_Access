// ============================================================================
// How CourtAccess Works — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import {
  UserPlus,
  FolderOpen,
  Upload,
  Brain,
  Share2,
  FileOutput,
  ArrowRight,
} from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const STEPS = [
  {
    icon: UserPlus,
    step: '1',
    title: 'Register & Subscribe',
    description:
      'Create your account, verify email, and start a free 30-day trial. Every subscriber receives full platform access — only storage and billing differ.',
  },
  {
    icon: FolderOpen,
    step: '2',
    title: 'Create Your Workspace',
    description:
      'Set up your organization, invite up to five designees (attorney, investigator, client, family, expert), and assign independent permissions.',
  },
  {
    icon: Upload,
    step: '3',
    title: 'Upload Evidence',
    description:
      'Import police reports, body-camera footage, discovery, and exhibits. Originals remain immutable; all changes are audited.',
  },
  {
    icon: Brain,
    step: '4',
    title: 'Analyze & Connect',
    description:
      'Map charges to California statutes, elements, CALCRIM instructions, and authorities. Surface contradictions, gaps, and unknowns.',
  },
  {
    icon: Share2,
    step: '5',
    title: 'Publish & Collaborate',
    description:
      'Redact documents, configure publication profiles, and share evidence with clients, investigators, and experts. Hidden material stays invisible.',
  },
  {
    icon: FileOutput,
    step: '6',
    title: 'Generate Reports',
    description:
      'Produce attorney, investigator, discovery, and trial reports — every conclusion linked to supporting evidence in the knowledge graph.',
  },
];

export function HowItWorksPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            How CourtAccess Works
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            From registration to litigation-ready reports — an evidence-governed workflow
            built for California criminal cases.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {STEPS.map(({ icon: Icon, step, title, description }) => (
              <div key={step} className="flex gap-6 p-6 rounded-xl border border-slate-200 bg-white/5">
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                    {step}
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Icon className="text-slate-600" size={20} />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
                  <p className="text-slate-600 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Ready to start?</h2>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Start Free 30-Day Trial
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
