// ============================================================================
// CourtAccess — Defense Landing Page (/for-defense)
// Phase 208: Audience-specific landing page for criminal defense professionals
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
  Globe,
  Lock,
  Map,
  FileDown,
  ChevronRight,
  Play,
} from 'lucide-react';

function DefenseNav() {
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
            <Link to="/for-prosecutors" className="text-sm text-slate-400 hover:text-white transition-colors">For Prosecutors</Link>
            <Link to="/government" className="text-sm text-slate-400 hover:text-white transition-colors">Government</Link>
            <Link to="/case-studies" className="text-sm text-slate-400 hover:text-white transition-colors">Case Studies</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors">
              Start Case Analysis
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function DefenseHero() {
  return (
    <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-8">
            <Shield className="text-amber-400" size={16} />
            <span className="text-amber-300 text-sm font-medium">For Criminal Defense</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Evidence Intelligence for{' '}
            <span className="text-amber-400">Criminal Defense</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Analyze police reports, body camera footage, and investigative evidence. Compare officer
            conduct against department policy, training standards, and legal procedures.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-10">
            {[
              'Compare conduct to department policies',
              'Reconstruct incidents with 3D exhibits',
              'Generate expert-ready reports',
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
              Start Case Analysis
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/20"
            >
              <Play size={18} />
              Request a Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

interface DefenseFeatureProps {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
}

function DefenseFeatureCard({ icon: Icon, title, description, items }: DefenseFeatureProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-6">
        <Icon className="text-amber-400" size={24} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 mb-5 leading-relaxed">{description}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
            <ChevronRight className="text-amber-500 shrink-0 mt-0.5" size={14} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DefenseFeatures() {
  const features: DefenseFeatureProps[] = [
    {
      icon: Globe,
      title: 'Policy Comparison',
      description: 'Compare officer conduct to department policies and training standards.',
      items: ['Use-of-force policies', 'Body camera policies', 'Internal affairs procedures', 'Training standards'],
    },
    {
      icon: Upload,
      title: 'Evidence Intelligence',
      description: 'Upload and analyze police reports, bodycam footage, dashcam video, and witness statements.',
      items: ['Automatic event extraction', 'Incident timeline construction', 'Officer action identification', 'Cross-source evidence linking'],
    },
    {
      icon: Map,
      title: 'Incident Reconstruction',
      description: 'Reconstruct incidents using 3D visual analysis and synchronized evidence.',
      items: ['Scene reconstruction from aerial maps', 'Officer line-of-sight analysis', 'Multi-camera synchronization', 'Interactive trial exhibits'],
    },
    {
      icon: Clock,
      title: 'Timeline Analysis',
      description: 'Synchronize all evidence sources into a unified, chronological timeline.',
      items: ['Force application events', 'Command issuance tracking', 'Weapon deployment timeline', 'Evidence-linked timestamps'],
    },
    {
      icon: Shield,
      title: 'Policy Compliance Analysis',
      description: 'Identify potential procedural inconsistencies across all evidence.',
      items: ['Use-of-force inconsistencies', 'Search and seizure issues', 'Evidence handling irregularities', 'Miranda warning timing'],
    },
    {
      icon: FileDown,
      title: 'Expert Witness Reports',
      description: 'Generate structured reports with evidence citations and policy references.',
      items: ['PDF and Word export', 'Trial exhibit packages', 'Evidence citations with timestamps', 'Policy reference annotations'],
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Tools for Criminal Defense
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Six integrated systems designed to help defense teams analyze evidence efficiently.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <DefenseFeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DefenseTestimonials() {
  const testimonials = [
    { quote: 'CourtAccess identified policy inconsistencies in minutes that would have taken our team days.', author: 'Criminal Defense Attorney' },
    { quote: 'The timeline synchronization tools transformed how we prepare for trial.', author: 'Defense Investigator' },
    { quote: 'Being able to compare officer actions to department policy is invaluable for case preparation.', author: 'Trial Attorney' },
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Trusted by Defense Professionals
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div key={t.author} className="bg-white rounded-2xl shadow-md border border-slate-200 p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="text-amber-400 fill-amber-400" size={18} />
                ))}
              </div>
              <blockquote className="text-slate-700 leading-relaxed mb-6 italic">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <p className="text-sm font-semibold text-slate-900">&mdash; {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DefenseCta() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Analyze Evidence More Efficiently
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
          Let CourtAccess help your defense team uncover the facts hidden inside case evidence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
          >
            Start Case Analysis
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/demo"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/20"
          >
            Request a Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

function DefenseFooter() {
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

export function ForDefensePage() {
  return (
    <div className="min-h-screen bg-white">
      <DefenseNav />
      <DefenseHero />
      <DefenseFeatures />
      <DefenseTestimonials />
      <DefenseCta />
      <DefenseFooter />
    </div>
  );
}
