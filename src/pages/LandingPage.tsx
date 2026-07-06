// ============================================================================
// CourtAccess Landing Page — Criminal Case Intelligence Platform
// courtaccess.net homepage
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { startSubscriptionCheckout } from '../services/membershipApi';
import {
  FileText,
  Search,
  Shield,
  Eye,
  Users,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Lock,
  Mail,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  Check,
  X,
  BookOpen,
  Scale,
  Gavel,
  Layers,
  Link2,
  HardDrive,
  Play,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Color tokens (Deep Navy / Slate Gray / Gold-Amber / White)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">CourtAccess</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</Link>
            <a href="#intelligence" className="text-sm text-slate-400 hover:text-white transition-colors">Case Intelligence</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
            <Link to="/about" className="text-sm text-slate-400 hover:text-white transition-colors">About</Link>
            <Link to="/faq" className="text-sm text-slate-400 hover:text-white transition-colors">FAQ</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-400 hover:text-white font-medium transition-colors hidden sm:inline"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-white/10 pt-4 space-y-3">
            <a href="#intelligence" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Case Intelligence</a>
            <Link to="/features" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Features</Link>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Pricing</a>
            <Link to="/about" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">About</Link>
            <Link to="/faq" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">FAQ</Link>
            <Link to="/contact" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Contact</Link>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Login</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// HERO SECTION
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="relative bg-[#0f172a] overflow-hidden pt-24">
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
            Your Criminal Case May Have Defenses{' '}
            <span className="text-amber-400">You Haven't Found Yet.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            CourtAccess helps organize, analyze, and connect the information in a
            criminal case to identify contradictions, evidence gaps, charge elements,
            jury instructions, legal authorities, and potentially relevant case issues.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/20"
            >
              Start Free 30-Day Trial
              <ArrowRight size={20} />
            </Link>
            <a
              href="#intelligence"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium px-8 py-4 rounded-xl text-lg transition-colors border border-white/10"
            >
              See How It Works
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {[
              { icon: Layers, label: 'Case Organization' },
              { icon: Search, label: 'Contradiction Analysis' },
              { icon: Scale, label: 'Charge & CALCRIM Mapping' },
              { icon: Gavel, label: 'Motion & Authority Research' },
              { icon: FileText, label: 'Intelligence Reports' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-slate-400 text-sm">
                <item.icon size={14} className="text-amber-500/80" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 1 — Case Intelligence
// ---------------------------------------------------------------------------

function CaseIntelligenceSection() {
  const capabilities = [
    {
      icon: Layers,
      title: 'Organize Case Information',
      description: 'Structure and connect the documents, records, and evidence in your case into a clear, navigable format.',
    },
    {
      icon: BarChart3,
      title: 'Analyze Evidence',
      description: 'Review evidence across sources to understand what the record contains and how different pieces relate.',
    },
    {
      icon: AlertTriangle,
      title: 'Identify Contradictions',
      description: 'Surface conflicting statements, inconsistent records, and discrepancies across case materials.',
    },
    {
      icon: Eye,
      title: 'Surface Evidence Gaps',
      description: 'Highlight areas where supporting evidence may be incomplete or where additional investigation may be warranted.',
    },
  ];

  return (
    <section id="intelligence" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Case Intelligence
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            CourtAccess organizes and analyzes the information in your criminal case so you can see what matters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="bg-slate-50 rounded-2xl p-7 border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0f172a] flex items-center justify-center mb-5">
                <cap.icon className="text-amber-400" size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#0f172a] mb-2">{cap.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 2 — Legal Analysis
// ---------------------------------------------------------------------------

function LegalAnalysisSection() {
  const items = [
    { icon: Scale, title: 'Charges', description: 'Organized presentation of all charges filed in your case.' },
    { icon: BookOpen, title: 'Elements', description: 'Breakdown of the legal elements required for each charge.' },
    { icon: FileText, title: 'CALCRIM Instructions', description: 'Relevant jury instructions mapped to your specific charges.' },
    { icon: Gavel, title: 'Motions', description: 'Track and organize motions filed by all parties.' },
    { icon: Search, title: 'Authorities', description: 'Relevant legal authorities and case law organized by issue.' },
  ];

  return (
    <section id="legal-analysis" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Legal Analysis
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            CourtAccess connects the facts of your case to the legal framework — charges, elements, instructions, and authorities.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {items.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0f172a] flex items-center justify-center mb-5">
                <item.icon className="text-amber-400" size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#0f172a] mb-2">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-10 max-w-lg mx-auto italic">
          CourtAccess organizes legal information for review purposes. All legal decisions should be made in consultation with qualified counsel.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 3 — Evidence Review
// ---------------------------------------------------------------------------

function EvidenceReviewSection() {
  const features = [
    {
      icon: FileText,
      title: 'Citation-Backed Findings',
      description: 'Every finding references the specific source material so you can verify it yourself.',
    },
    {
      icon: BarChart3,
      title: 'Proof Analysis',
      description: 'Review what evidence exists for each element of each charge in your case.',
    },
    {
      icon: Link2,
      title: 'Evidence Mapping',
      description: 'Visualize how different pieces of evidence connect to charges, witnesses, and events.',
    },
    {
      icon: AlertTriangle,
      title: 'Contradiction Analysis',
      description: 'Cross-reference statements, records, and evidence to surface inconsistencies.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Evidence Review
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Structured, citation-backed analysis of the evidence in your case.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-50 rounded-2xl p-7 border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0f172a] flex items-center justify-center mb-5">
                <f.icon className="text-amber-400" size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#0f172a] mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 4 — Who Uses CourtAccess
// ---------------------------------------------------------------------------

function WhoUsesSection() {
  const audiences = [
    {
      icon: Users,
      title: 'Defendants',
      description: 'Understand the information in your criminal case and what it may mean for your defense.',
    },
    {
      icon: Shield,
      title: 'Family Members',
      description: 'Help a loved one by reviewing organized case information and understanding what has been filed.',
    },
    {
      icon: Briefcase,
      title: 'Attorneys',
      description: 'Receive structured case intelligence, contradiction analysis, and citation-backed research.',
    },
    {
      icon: Search,
      title: 'Investigators',
      description: 'Review evidence connections, identify gaps, and track how case materials relate.',
    },
  ];

  return (
    <section id="who" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Who Uses CourtAccess
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {audiences.map((a) => (
            <div
              key={a.title}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#0f172a] flex items-center justify-center mx-auto mb-5">
                <a.icon className="text-amber-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#0f172a] mb-2">{a.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 5 — Pricing
// ---------------------------------------------------------------------------

const allFeatures = [
  'Charge analysis',
  'CALCRIM analysis',
  'Motion analysis',
  'Authority research',
  'Contradiction analysis',
  'Evidence-gap analysis',
  'Timeline generation',
  'Attorney report generation',
  'All platform features',
];

function PlanSubscribeButton({ planId, label }: { planId: string; label: string }) {
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }
    setLoading(true);
    try {
      const { url } = await startSubscriptionCheckout(planId, 'month');
      if (url) window.location.href = url;
    } catch {
      window.location.href = '/pricing';
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors disabled:opacity-50"
    >
      {loading ? 'Redirecting…' : label}
    </button>
  );
}

function PricingSection() {
  const plans = [
    {
      name: 'Free Trial',
      planId: 'TRIAL',
      price: '$0',
      period: 'for 30 Days',
      storage: '250 MB',
      credits: null,
      extraStorage: null,
      highlight: false,
      featured: true,
      notes: [
        'No credit card required',
        'Full functionality',
        'Data retained for 30 days',
        'Export reports before expiration',
      ],
    },
    {
      name: 'Individual',
      planId: 'INDIVIDUAL',
      price: '$29',
      period: '/month',
      storage: '5 GB',
      credits: '50 credits',
      extraStorage: '$3/mo per additional GB',
      highlight: false,
      featured: false,
      notes: ['Long-term storage', 'Full platform access'],
    },
    {
      name: 'Standard',
      planId: 'STANDARD',
      price: '$79',
      period: '/month',
      storage: '25 GB',
      credits: '250 credits',
      extraStorage: '$2/mo per additional GB',
      highlight: true,
      featured: false,
      notes: ['Full platform access'],
    },
    {
      name: 'Complex Case',
      planId: 'COMPLEX_CASE',
      price: '$149',
      period: '/month',
      storage: '100 GB',
      credits: '1,000 credits',
      extraStorage: '$1.50/mo per additional GB',
      highlight: false,
      featured: false,
      notes: ['Full platform access'],
    },
    {
      name: 'Professional',
      planId: 'PROFESSIONAL',
      price: '$399',
      period: '/month',
      storage: '1 TB',
      credits: '5,000 credits',
      extraStorage: '$1/mo per additional GB',
      highlight: false,
      featured: false,
      notes: ['Multi-case support', 'Full platform access'],
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Experience the full CourtAccess platform free for 30 days. No credit card required.
          </p>
        </div>

        {/* Free trial feature callout */}
        <div className="max-w-3xl mx-auto mb-14 bg-[#0f172a] rounded-2xl p-8 text-center border border-slate-700/50">
          <p className="text-amber-400 text-sm font-semibold uppercase tracking-wide mb-3">Free 30-Day Trial</p>
          <p className="text-white text-lg leading-relaxed mb-6">
            Analyze charges, jury instructions, motions, authorities, evidence,
            contradictions, and case intelligence with no credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {allFeatures.map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-sm text-slate-300">
                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                {f}
              </span>
            ))}
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/20"
          >
            Start Free 30-Day Trial
            <ArrowRight size={20} />
          </Link>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border flex flex-col ${
                plan.highlight
                  ? 'bg-[#0f172a] border-amber-500/50 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/30'
                  : plan.featured
                    ? 'bg-[#0f172a] border-slate-700/50'
                    : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                plan.highlight || plan.featured ? 'text-amber-400' : 'text-amber-600'
              }`}>
                {plan.name}
              </p>
              <div className="mb-1">
                <span className={`text-3xl font-extrabold ${
                  plan.highlight || plan.featured ? 'text-white' : 'text-[#0f172a]'
                }`}>
                  {plan.price}
                </span>
                <span className={`text-sm ml-1 ${
                  plan.highlight || plan.featured ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {plan.period}
                </span>
              </div>

              <div className={`flex items-center gap-2 mb-1 text-sm ${
                plan.highlight || plan.featured ? 'text-slate-300' : 'text-slate-600'
              }`}>
                <HardDrive size={14} className="text-amber-500 shrink-0" />
                {plan.storage} storage
              </div>

              {plan.credits && (
                <div className={`flex items-center gap-2 mb-1 text-sm ${
                  plan.highlight ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  <Play size={14} className="text-amber-500 shrink-0" />
                  {plan.credits}
                </div>
              )}

              {plan.extraStorage && (
                <p className={`text-xs mt-1 ${
                  plan.highlight ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  {plan.extraStorage}
                </p>
              )}

              <ul className="mt-4 space-y-2 flex-1">
                {plan.notes.map((note) => (
                  <li key={note} className={`flex items-start gap-2 text-xs ${
                    plan.highlight || plan.featured ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <CheckCircle2 size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    {note}
                  </li>
                ))}
              </ul>
              {plan.planId === 'TRIAL' ? (
                <Link
                  to="/register"
                  className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors text-center block"
                >
                  Start Free Trial
                </Link>
              ) : (
                <PlanSubscribeButton planId={plan.planId} label="Subscribe" />
              )}
            </div>
          ))}
        </div>

        {/* Video & Large Evidence Processing */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-extrabold text-[#0f172a] mb-3 tracking-tight">
              Video &amp; Large Evidence Processing
            </h3>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm leading-relaxed">
              Storage keeps files available. Processing analyzes large evidence files.
              Each credit equals 10 minutes of video processing.
            </p>
          </div>

          {/* Monthly included credits */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { plan: 'Individual', credits: '50' },
              { plan: 'Standard', credits: '250' },
              { plan: 'Complex Case', credits: '1,000' },
              { plan: 'Professional', credits: '5,000' },
            ].map((tier) => (
              <div key={tier.plan} className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                <p className="text-xs text-slate-500 mb-1">{tier.plan}</p>
                <p className="text-lg font-bold text-[#0f172a]">{tier.credits}</p>
                <p className="text-xs text-slate-400">credits/month</p>
              </div>
            ))}
          </div>

          {/* Additional credit packs */}
          <div className="bg-[#0f172a] rounded-2xl p-6 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-4 text-center">
              Additional Credit Packs
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { credits: '100 Credits', price: '$10' },
                { credits: '500 Credits', price: '$40' },
                { credits: '2,500 Credits', price: '$150' },
              ].map((pack) => (
                <div key={pack.credits} className="bg-[#1e293b] rounded-xl p-4 text-center border border-slate-700/30">
                  <p className="text-white font-bold text-lg">{pack.credits}</p>
                  <p className="text-amber-400 font-semibold">{pack.price}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-500 mt-4">
              1 Credit = 10 Minutes of Video Processing
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-bold px-10 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/20"
          >
            Start Free 30-Day Trial
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 6 — Why CourtAccess
// ---------------------------------------------------------------------------

function WhyCourtAccessSection() {
  const rows = [
    { feature: 'Case organization', traditional: 'Manual, fragmented', courtaccess: 'Structured & connected' },
    { feature: 'Contradiction detection', traditional: 'Read everything yourself', courtaccess: 'Automated cross-referencing' },
    { feature: 'Legal research', traditional: 'Hours of manual search', courtaccess: 'Citation-backed analysis' },
    { feature: 'Evidence-to-charge mapping', traditional: false, courtaccess: true },
    { feature: 'CALCRIM instruction mapping', traditional: false, courtaccess: true },
    { feature: 'Intelligence reports', traditional: 'Manual assembly', courtaccess: 'Organized & exportable' },
  ];

  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Why CourtAccess
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            CourtAccess organizes complex criminal case information, connects evidence to legal requirements, and helps users understand what information exists in the record.
          </p>
        </div>

        <div className="max-w-3xl mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-3 bg-[#0f172a] text-white text-sm font-semibold">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 text-center border-l border-slate-700/50">Traditional Approach</div>
            <div className="px-6 py-4 text-center border-l border-slate-700/50 bg-amber-500/10 text-amber-400">CourtAccess</div>
          </div>

          {rows.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
              <div className="px-6 py-4 font-medium text-[#0f172a]">{row.feature}</div>
              <div className="px-6 py-4 text-center text-slate-400 border-l border-slate-100 flex items-center justify-center gap-1">
                {typeof row.traditional === 'boolean' ? (
                  row.traditional ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-slate-300" />
                ) : (
                  row.traditional
                )}
              </div>
              <div className="px-6 py-4 text-center text-[#0f172a] font-medium border-l border-slate-100 flex items-center justify-center gap-1">
                {typeof row.courtaccess === 'boolean' ? (
                  row.courtaccess ? <Check size={16} className="text-amber-500" /> : <X size={16} className="text-slate-300" />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ChevronRight size={14} className="text-amber-500" />
                    {row.courtaccess}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Legal Disclaimer
// ---------------------------------------------------------------------------

function LegalDisclaimerSection() {
  return (
    <section className="py-16 bg-white border-t border-slate-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Lock size={24} className="text-slate-300 mx-auto mb-4" />
        <div className="space-y-3 text-sm text-slate-500 leading-relaxed">
          <p className="font-semibold text-slate-600">CourtAccess is not a law firm.</p>
          <p>CourtAccess does not provide legal advice.</p>
          <p>CourtAccess does not guarantee outcomes.</p>
          <p>The existence of defenses is not guaranteed for any case.</p>
          <p>All legal decisions should be made in consultation with qualified counsel.</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function LandingFooter() {
  return (
    <footer className="bg-[#0f172a] border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
                <Shield className="text-white" size={18} />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CourtAccess</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Criminal Case Intelligence Platform
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/faq" className="text-sm text-slate-400 hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-sm text-slate-400 hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/legal-disclaimer" className="text-sm text-slate-400 hover:text-white transition-colors">Legal Disclaimer</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2">
              <li>
                <a href="mailto:support@courtaccess.net" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                  <Mail size={14} />
                  support@courtaccess.net
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} CourtAccess. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">
            Criminal Case Intelligence Platform
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <div className="pt-20">
        <PricingSection />
      </div>
      <LegalDisclaimerSection />
      <LandingFooter />
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <HeroSection />
      <CaseIntelligenceSection />
      <LegalAnalysisSection />
      <EvidenceReviewSection />
      <WhoUsesSection />
      <PricingSection />
      <WhyCourtAccessSection />
      <LegalDisclaimerSection />
      <LandingFooter />
    </div>
  );
}
