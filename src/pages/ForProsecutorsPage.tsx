// ============================================================================
// CourtAccess — Prosecutor Landing Page (/for-prosecutors)
// Phase 208: Audience-specific landing page for prosecution offices
// ============================================================================

import { Link } from 'react-router-dom';
import {
  Scale,
  Shield,
  Search,
  FileText,
  Clock,
  Upload,
  CheckCircle2,
  ArrowRight,
  Star,
  Lock,
  Layers,
  ChevronRight,
  Briefcase,
  AlertTriangle,
  FolderSync,
} from 'lucide-react';

function ProsecutorNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800">
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
            <Link to="/government" className="text-sm text-slate-400 hover:text-white transition-colors">Government</Link>
            <Link to="/case-studies" className="text-sm text-slate-400 hover:text-white transition-colors">Case Studies</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function ProsecutorHero() {
  return (
    <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
            <Briefcase className="text-blue-400" size={16} />
            <span className="text-blue-300 text-sm font-medium">For Prosecutors</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Evidence Intelligence for{' '}
            <span className="text-blue-400">Prosecutors</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Organize case evidence, synchronize sources, assist Brady compliance review,
            and prepare for trial with structured analytical tools.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-10">
            {[
              'Organize and synchronize case evidence',
              'Assist Brady compliance review',
              'Prepare structured trial materials',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
                <span className="text-sm sm:text-base">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
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

function ProsecutorFeatures() {
  const features = [
    {
      icon: FolderSync,
      title: 'Case Organization',
      description: 'Centralize all case evidence — reports, video, audio, documents — in a single organized workspace.',
      items: ['Unified evidence repository', 'Automatic categorization', 'Cross-reference tracking', 'Case file management'],
    },
    {
      icon: Upload,
      title: 'Evidence Synchronization',
      description: 'Synchronize evidence from multiple sources into a unified, chronological view.',
      items: ['Multi-source timeline construction', 'Video and report synchronization', 'Witness statement alignment', 'Chain of custody tracking'],
    },
    {
      icon: AlertTriangle,
      title: 'Brady Compliance Assistance',
      description: 'Tools to help identify potentially exculpatory material within case evidence.',
      items: ['Evidence review checklists', 'Disclosure tracking', 'Material flagging system', 'Compliance audit trail'],
    },
    {
      icon: Clock,
      title: 'Trial Preparation',
      description: 'Build structured trial materials with evidence citations and organized exhibits.',
      items: ['Trial exhibit generation', 'Evidence-linked timelines', 'Witness preparation materials', 'Structured case summaries'],
    },
    {
      icon: Search,
      title: 'Investigative Analysis',
      description: 'Analyze evidence to identify key events, actions, and procedural details.',
      items: ['Automatic event extraction', 'Action identification', 'Procedural timeline mapping', 'Cross-evidence analysis'],
    },
    {
      icon: Layers,
      title: 'Multi-Agency Coordination',
      description: 'Support cases involving multiple law enforcement agencies and jurisdictions.',
      items: ['Multi-agency evidence management', 'Jurisdictional organization', 'Inter-agency communication tracking', 'Consolidated case views'],
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Tools for Prosecution Offices
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Analytical tools designed to help prosecutors organize evidence and prepare for trial.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-6">
                <f.icon className="text-blue-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
              <p className="text-slate-600 mb-5 leading-relaxed">{f.description}</p>
              <ul className="space-y-2">
                {f.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <ChevronRight className="text-blue-500 shrink-0 mt-0.5" size={14} />
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

function ProsecutorSecurity() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Government-Grade Security
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Built with the security requirements of government agencies in mind.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { icon: Shield, label: 'Role-based access controls' },
            { icon: Lock, label: 'Encrypted evidence storage' },
            { icon: FileText, label: 'Audit trail logging' },
            { icon: Star, label: 'CJIS compatibility preparation' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <item.icon className="text-blue-600" size={22} />
              </div>
              <p className="text-sm font-medium text-slate-800">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProsecutorCta() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Modernize Your Evidence Analysis
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
          Start analyzing evidence today or contact our team for enterprise licensing.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
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

function ProsecutorFooter() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scale className="text-white" size={16} />
            </div>
            <span className="text-white font-semibold">CourtAccess</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock size={14} />
            <span>Criminal Evidence Intelligence Platform</span>
          </div>
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} CourtAccess. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function ForProsecutorsPage() {
  return (
    <div className="min-h-screen bg-white">
      <ProsecutorNav />
      <ProsecutorHero />
      <ProsecutorFeatures />
      <ProsecutorSecurity />
      <ProsecutorCta />
      <ProsecutorFooter />
    </div>
  );
}
