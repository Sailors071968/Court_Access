// ============================================================================
// Security Page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Key,
  Eye,
  Server,
  FileCheck,
  Users,
  ArrowRight,
} from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const SECURITY_FEATURES = [
  {
    icon: Users,
    title: 'Tenant Isolation',
    description: 'Every organization operates in a fully isolated data boundary. Cross-tenant access is architecturally impossible.',
  },
  {
    icon: Key,
    title: 'Role-Based Access Control',
    description: 'Fine-grained permissions for view, comment, upload, edit, approve, publish, and administer — scoped to cases, evidence, and documents.',
  },
  {
    icon: Lock,
    title: 'Encryption',
    description: 'Data encrypted in transit (TLS 1.2+) and at rest. Evidence files stored in encrypted object storage with access logging.',
  },
  {
    icon: Shield,
    title: 'Multi-Factor Authentication',
    description: 'MFA available for all accounts. Session management with secure cookies and configurable expiry.',
  },
  {
    icon: Eye,
    title: 'Audit Logging',
    description: 'Immutable audit trails for evidence access, publication, redaction, permission changes, and billing events.',
  },
  {
    icon: FileCheck,
    title: 'Chain of Custody',
    description: 'Original evidence files are never modified. Redactions produce permanent publication copies with full provenance.',
  },
  {
    icon: Server,
    title: 'Secrets Management',
    description: 'API keys, database credentials, and Stripe secrets stored in environment configuration — never in source code.',
  },
  {
    icon: Shield,
    title: 'Non-Disclosure by Design',
    description: 'Publication profiles ensure recipients never know excluded information exists. Hidden material is invisible, not merely restricted.',
  },
];

export function SecurityPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
            <Shield className="text-emerald-400" size={16} />
            <span className="text-emerald-300 text-sm font-medium">Security & Trust</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Built for Criminal Litigation
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            CourtAccess is designed for the highest-stakes evidence environments.
            Security is not a feature — it is the foundation.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SECURITY_FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-5 rounded-xl border border-slate-200 bg-white/5">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="text-emerald-600" size={20} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2 text-sm">{title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-600 mb-6">
            For security inquiries, contact{' '}
            <a href="mailto:security@courtaccess.net" className="text-amber-600 hover:underline">
              security@courtaccess.net
            </a>
          </p>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-500 font-semibold"
          >
            Read Privacy Policy
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
