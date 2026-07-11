// ============================================================================
// CourtAccess — Government Procurement Page (/government)
// Phase 209: Government deployment and procurement information
// ============================================================================

import { Link } from 'react-router-dom';
import {
  Scale,
  Shield,
  Lock,
  Building2,
  Server,
  Users,
  FileText,
  CheckCircle2,
  ArrowRight,
  Landmark,
  Globe,
} from 'lucide-react';

function GovNav() {
  return (
    <nav className="bg-slate-900 border-b border-gold">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold text-white">CourtAccess</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/for-defense" className="text-sm text-slate-400 hover:text-white transition-colors">For Defense</Link>
            <Link to="/for-prosecutors" className="text-sm text-slate-400 hover:text-white transition-colors">For Prosecutors</Link>
            <Link to="/case-studies" className="text-sm text-slate-400 hover:text-white transition-colors">Case Studies</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="text-sm bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function GovHero() {
  return (
    <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
            <Landmark className="text-blue-400" size={16} />
            <span className="text-blue-300 text-sm font-medium">Government &amp; Enterprise</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            CourtAccess for{' '}
            <span className="text-amber-400">Government Agencies</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Deploy CourtAccess across your office with enterprise licensing,
            secure infrastructure, and dedicated support for government agencies.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
            >
              Start Your First Case Analysis
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/20"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function GovAgencies() {
  const agencies = [
    { icon: Building2, title: 'County District Attorney Offices', description: 'Organize case evidence, assist Brady compliance review, and prepare structured trial materials for prosecution teams.' },
    { icon: Shield, title: 'County Public Defender Offices', description: 'Analyze evidence, compare officer conduct to department policies, and generate expert-ready reports for defense teams.' },
    { icon: Landmark, title: 'State Agencies', description: 'Support statewide criminal justice operations with multi-office deployment and centralized case management.' },
    { icon: Globe, title: 'Federal Defender Offices', description: 'Enterprise-grade evidence analysis tools designed for federal case complexity and multi-jurisdictional investigations.' },
  ];

  return (
    <section className="py-20 bg-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Designed for Government Deployment
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            CourtAccess supports deployment across the criminal justice system.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {agencies.map((agency) => (
            <div key={agency.title} className="bg-white/5 rounded-2xl shadow-md border border-white/10 p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                <agency.icon className="text-slate-200" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{agency.title}</h3>
              <p className="text-slate-300 leading-relaxed">{agency.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GovEnterprise() {
  const sections = [
    {
      title: 'Enterprise Licensing',
      icon: Users,
      items: [
        'County-wide site licenses',
        'Multi-office deployment',
        'Enterprise admin accounts',
        'Flexible seat-based pricing',
        'Annual and multi-year options',
      ],
    },
    {
      title: 'Secure Infrastructure',
      icon: Server,
      items: [
        'Encrypted data at rest and in transit',
        'Role-based access controls',
        'Security event logging and audit trail',
        'Rate limiting and CSRF protection',
        'Configurable security headers',
      ],
    },
    {
      title: 'CJIS Compatibility Preparation',
      icon: Shield,
      items: [
        'Access control policy alignment',
        'Audit and accountability logging',
        'Authentication and authorization controls',
        'Media protection for evidence files',
        'Physical security documentation',
      ],
    },
    {
      title: 'Case Management Integration',
      icon: FileText,
      items: [
        'API-based evidence import/export',
        'Structured data formats (JSON, PDF)',
        'Webhook notifications for case events',
        'Configurable workflow integration',
        'Batch evidence processing',
      ],
    },
  ];

  return (
    <section className="py-20 bg-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Enterprise Capabilities
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sections.map((section) => (
            <div key={section.title} className="bg-white/5 rounded-2xl shadow-md border border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <section.icon className="text-amber-600" size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">{section.title}</h3>
              </div>
              <ul className="space-y-3">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GovProcess() {
  const steps = [
    { step: 1, title: 'Create Your Account', description: 'Sign up and start analyzing your first case immediately.' },
    { step: 2, title: 'Pilot Deployment', description: 'Test CourtAccess with a limited case set in your environment.' },
    { step: 3, title: 'Enterprise Licensing', description: 'Contact sales to configure seat count, office access, and admin accounts.' },
    { step: 4, title: 'Full Deployment', description: 'Roll out across your office with training and dedicated support.' },
  ];

  return (
    <section className="py-20 bg-white/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Procurement Process
          </h2>
        </div>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.step} className="flex items-start gap-6 p-6 bg-white/5 rounded-xl border border-white/10">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{s.title}</h3>
                <p className="text-slate-300">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GovCta() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Ready to Modernize Your Office?
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
          Contact us to discuss enterprise licensing and deployment options for your agency.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
          >
            Create Your Account
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/contact"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/20"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

function GovFooter() {
  return (
    <footer className="bg-slate-900 border-t border-gold py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scale className="text-white" size={16} />
            </div>
            <span className="text-white font-semibold">CourtAccess</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Lock size={14} />
            <span>Criminal Evidence Intelligence Platform</span>
          </div>
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} CourtAccess. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function GovernmentPage() {
  return (
    <div className="min-h-screen bg-white/5">
      <GovNav />
      <GovHero />
      <GovAgencies />
      <GovEnterprise />
      <GovProcess />
      <GovCta />
      <GovFooter />
    </div>
  );
}
