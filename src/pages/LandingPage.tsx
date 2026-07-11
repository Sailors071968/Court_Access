// ============================================================================
// CourtAccess Landing Page — Criminal Case Intelligence Platform
// Uses unified design system (Programs 1–3)
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { startSubscriptionCheckout } from '../services/membershipApi';
import { PublicMarketingLayout } from '../components/marketing/PublicMarketingLayout';
import { HeroSection } from '../components/marketing/landing/HeroSection';
import {
  FileText,
  Search,
  Shield,
  Eye,
  Users,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  AlertTriangle,
  BookOpen,
  Scale,
  Gavel,
  Layers,
  Link2,
  HardDrive,
  Play,
  Lock,
  Check,
  X,
  ChevronRight,
  Clock,
  ScanLine,
  Landmark,
  Building2,
} from 'lucide-react';

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
    <section id="intelligence" className="py-20 lg:py-28 bg-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Case Intelligence
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            CourtAccess organizes and analyzes the information in your criminal case so you can see what matters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="ca-panel ca-panel-hover p-7"
            >
              <div className="w-12 h-12 rounded-xl ca-icon-gold flex items-center justify-center mb-5">
                <cap.icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{cap.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{cap.description}</p>
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
    <section id="legal-analysis" className="py-20 lg:py-28 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Legal Analysis
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            CourtAccess connects the facts of your case to the legal framework — charges, elements, instructions, and authorities.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {items.map((item) => (
            <div
              key={item.title}
              className="ca-panel ca-panel-hover p-6"
            >
              <div className="w-12 h-12 rounded-xl ca-icon-gold flex items-center justify-center mb-5">
                <item.icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
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
    <section className="py-20 lg:py-28 bg-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Evidence Review
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Structured, citation-backed analysis of the evidence in your case.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="ca-panel ca-panel-hover p-7"
            >
              <div className="w-12 h-12 rounded-xl ca-icon-gold flex items-center justify-center mb-5">
                <f.icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION — Platform Features (Program 83, Phase 5)
// ---------------------------------------------------------------------------

function PlatformFeaturesSection() {
  const features = [
    { icon: Shield, tone: 'ca-icon-gold text-gold-light', title: 'Evidence Intelligence', desc: 'OCR, extraction, and hash-verified analysis across every item of case evidence.' },
    { icon: Link2, tone: 'ca-icon-blue text-blue-300', title: 'Knowledge Graph', desc: 'Interconnected charges, evidence, witnesses, timeline events, and authorities.' },
    { icon: Clock, tone: 'ca-icon-violet text-violet-300', title: 'Timeline Builder', desc: 'Evidence-governed chronological reconstruction traced back to the record.' },
    { icon: BookOpen, tone: 'ca-icon-emerald text-emerald-300', title: 'Authority Search', desc: 'Statutes, case law, and CALCRIM jury instructions in one repository-backed search.' },
    { icon: Gavel, tone: 'ca-icon-gold text-gold-light', title: 'Motion Builder', desc: 'Draft and organize motions with linked, citation-backed authority.' },
    { icon: HardDrive, tone: 'ca-icon-blue text-blue-300', title: 'Repository Intelligence', desc: 'Hash-verified California statute repository with provenance on every record.' },
    { icon: Landmark, tone: 'ca-icon-violet text-violet-300', title: 'CourtListener', desc: 'Federal & state case law via the Free Law Project, integrated in-app.' },
    { icon: FileText, tone: 'ca-icon-emerald text-emerald-300', title: 'California Repository', desc: 'Repository-backed California codes and sections with automatic offense mapping.' },
    { icon: ScanLine, tone: 'ca-icon-gold text-gold-light', title: 'OCR', desc: 'Text extraction from PDFs, images, and documents — never fabricated.' },
    { icon: AlertTriangle, tone: 'ca-icon-blue text-blue-300', title: 'Contradiction Detection', desc: 'Surface conflicting statements and inconsistencies across the record.' },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-light mb-3">The Platform</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">Litigation Intelligence, End to End</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">Ten integrated capabilities — every finding citation-backed, every source verifiable.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {features.map((f) => (
            <div key={f.title} className="ca-panel ca-panel-hover p-6 group">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.tone} transition-transform group-hover:scale-105`}>
                <f.icon size={22} />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION — Illustrative Demonstration Showcase (Program 94, Phase 7)
// ---------------------------------------------------------------------------

function DemoShowcaseSection() {
  const previews = [
    { title: 'Attorney Report', to: '/demo/reports/attorney-report' },
    { title: 'Knowledge Graph', to: '/demo/knowledge-graph' },
    { title: 'Timeline', to: '/demo/timeline' },
    { title: 'Motion Builder', to: '/demo/reports/motion' },
    { title: 'Sentencing Center', to: '/demo/reports/sentencing' },
    { title: 'Evidence Workspace', to: '/demo/reports/evidence' },
  ];
  return (
    <section id="demo" className="py-20 lg:py-28 bg-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300 mb-3">Illustrative Example · Demonstration Only</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">See the work product before you sign up</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">Browse a fully illustrative criminal case across every workspace — no account required. Every example is clearly labeled and contains no real case data.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {previews.map((p) => (
            <Link key={p.title} to={p.to} className="ca-panel ca-panel-hover p-6 group relative overflow-hidden">
              <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-amber-400/70">Illustrative</span>
              <h3 className="text-base font-semibold text-white group-hover:text-gold-light transition-colors">{p.title}</h3>
              <p className="text-slate-500 text-sm mt-1">View example →</p>
            </Link>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/demo" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl ca-gradient-gold text-navy font-semibold hover:opacity-90">Explore the demonstration gallery</Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 4 — Who CourtAccess Serves (Program 83, Phase 6 — premium roles)
// ---------------------------------------------------------------------------

function WhoUsesSection() {
  const roles = [
    { icon: Briefcase, tone: 'ca-icon-gold text-gold-light', title: 'Attorneys', description: 'Structured case intelligence, contradiction analysis, and citation-backed research from one workspace.' },
    { icon: Search, tone: 'ca-icon-blue text-blue-300', title: 'Investigators', description: 'Track evidence connections, log witnesses and leads, and identify gaps across the record.' },
    { icon: Scale, tone: 'ca-icon-violet text-violet-300', title: 'Prosecutors', description: 'Organize charges, evidence, and authorities with a verifiable chain of citations.' },
    { icon: Shield, tone: 'ca-icon-emerald text-emerald-300', title: 'Public Defenders', description: 'Manage heavy caseloads with evidence-governed analysis and rapid discovery review.' },
    { icon: Layers, tone: 'ca-icon-gold text-gold-light', title: 'Paralegals', description: 'Assemble evidence, timelines, and discovery with unlimited collaborator access.' },
    { icon: FileText, tone: 'ca-icon-blue text-blue-300', title: 'Legal Assistants', description: 'Upload discovery, run OCR, and keep the case record organized and searchable.' },
    { icon: Building2, tone: 'ca-icon-violet text-violet-300', title: 'Law Firms', description: 'A multi-office operating platform with firm-wide collaborators, roles, and permissions.' },
    { icon: Users, tone: 'ca-icon-emerald text-emerald-300', title: 'Clients & Families', description: 'Understand the case record through a secure, permissioned client portal.' },
  ];

  return (
    <section id="who" className="py-20 lg:py-28 bg-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-light mb-3">Built for the whole team</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">Who CourtAccess Serves</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {roles.map((r) => (
            <div key={r.title} className="ca-panel ca-panel-hover p-6 text-center group">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${r.tone} transition-transform group-hover:scale-105`}>
                <r.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{r.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{r.description}</p>
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
  'Unlimited collaborators',
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
      className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 transition-all disabled:opacity-50"
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
    <section id="pricing" className="py-20 lg:py-28 bg-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Experience the full CourtAccess platform free for 30 days. No credit card required.
          </p>
        </div>

        {/* Free trial feature callout */}
        <div className="max-w-3xl mx-auto mb-14 bg-navy rounded-2xl p-8 text-center border border-slate-700/50">
          <p className="text-gold-light text-sm font-semibold uppercase tracking-wide mb-3">Free 30-Day Trial</p>
          <p className="text-white text-lg leading-relaxed mb-6">
            Analyze charges, jury instructions, motions, authorities, evidence,
            contradictions, and case intelligence with no credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {allFeatures.map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-sm text-slate-300">
                <CheckCircle2 size={14} className="text-gold-light shrink-0" />
                {f}
              </span>
            ))}
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 ca-gradient-gold text-navy font-bold px-8 py-4 rounded-xl text-lg hover:brightness-110 transition-all shadow-gold"
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
                  ? 'bg-navy border-amber-500/50 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/30'
                  : plan.featured
                    ? 'bg-navy border-slate-700/50'
                    : 'bg-navy-600/60 border-white/10'
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                plan.highlight || plan.featured ? 'text-gold-light' : 'text-gold'
              }`}>
                {plan.name}
              </p>
              <div className="mb-1">
                <span className={`text-3xl font-extrabold ${
                  plan.highlight || plan.featured ? 'text-white' : 'text-white'
                }`}>
                  {plan.price}
                </span>
                <span className={`text-sm ml-1 ${
                  plan.highlight || plan.featured ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  {plan.period}
                </span>
              </div>

              <div className={`flex items-center gap-2 mb-1 text-sm ${
                plan.highlight || plan.featured ? 'text-slate-300' : 'text-slate-300'
              }`}>
                <HardDrive size={14} className="text-amber-500 shrink-0" />
                {plan.storage} storage
              </div>

              {plan.credits && (
                <div className={`flex items-center gap-2 mb-1 text-sm ${
                  plan.highlight ? 'text-slate-300' : 'text-slate-300'
                }`}>
                  <Play size={14} className="text-amber-500 shrink-0" />
                  {plan.credits}
                </div>
              )}

              {plan.extraStorage && (
                <p className={`text-xs mt-1 ${
                  plan.highlight ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  {plan.extraStorage}
                </p>
              )}

              <ul className="mt-4 space-y-2 flex-1">
                {plan.notes.map((note) => (
                  <li key={note} className={`flex items-start gap-2 text-xs ${
                    plan.highlight || plan.featured ? 'text-slate-400' : 'text-slate-400'
                  }`}>
                    <CheckCircle2 size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    {note}
                  </li>
                ))}
              </ul>
              {plan.planId === 'TRIAL' ? (
                <Link
                  to="/register"
                  className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 transition-all text-center block"
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
            <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight">
              Video &amp; Large Evidence Processing
            </h3>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">
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
              <div key={tier.plan} className="bg-navy-600/60 rounded-xl border border-white/10 text-center">
                <p className="text-xs text-slate-400 mb-1">{tier.plan}</p>
                <p className="text-lg font-bold text-white">{tier.credits}</p>
                <p className="text-xs text-slate-400">credits/month</p>
              </div>
            ))}
          </div>

          {/* Additional credit packs */}
          <div className="bg-navy rounded-2xl p-6 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-gold-light uppercase tracking-wide mb-4 text-center">
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
                  <p className="text-gold-light font-semibold">{pack.price}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 mt-4">
              1 Credit = 10 Minutes of Video Processing
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 ca-gradient-gold text-navy font-bold px-10 py-4 rounded-xl text-lg hover:brightness-110 transition-all shadow-gold"
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
    <section className="py-20 lg:py-28 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Why CourtAccess
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            CourtAccess organizes complex criminal case information, connects evidence to legal requirements, and helps users understand what information exists in the record.
          </p>
        </div>

        <div className="max-w-3xl mx-auto overflow-hidden rounded-2xl border border-white/10 ca-panel">
          <div className="grid grid-cols-3 bg-navy-900 text-white text-sm font-semibold">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 text-center border-l border-white/10">Traditional Approach</div>
            <div className="px-6 py-4 text-center border-l border-white/10 bg-gold/10 text-gold-light">CourtAccess</div>
          </div>

          {rows.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'} border-t border-white/5`}>
              <div className="px-6 py-4 font-medium text-white">{row.feature}</div>
              <div className="px-6 py-4 text-center text-slate-400 border-l border-white/5 flex items-center justify-center gap-1">
                {typeof row.traditional === 'boolean' ? (
                  row.traditional ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-slate-400" />
                ) : (
                  row.traditional
                )}
              </div>
              <div className="px-6 py-4 text-center text-white font-medium border-l border-white/5 flex items-center justify-center gap-1">
                {typeof row.courtaccess === 'boolean' ? (
                  row.courtaccess ? <Check size={16} className="text-gold-light" /> : <X size={16} className="text-slate-400" />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ChevronRight size={14} className="text-gold-light" />
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
    <section className="py-16 bg-navy-900 border-t border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Lock size={24} className="text-slate-400 mx-auto mb-4" />
        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
          <p className="font-semibold text-slate-200">CourtAccess is not a law firm.</p>
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
// Exports
// ---------------------------------------------------------------------------

export function PricingPage() {
  return (
    <PublicMarketingLayout>
      <PricingSection />
      <LegalDisclaimerSection />
    </PublicMarketingLayout>
  );
}

export function LandingPage() {
  return (
    <PublicMarketingLayout className="bg-navy-800">
      <HeroSection />
      <PlatformFeaturesSection />
      <DemoShowcaseSection />
      <CaseIntelligenceSection />
      <LegalAnalysisSection />
      <EvidenceReviewSection />
      <WhoUsesSection />
      <PricingSection />
      <WhyCourtAccessSection />
      <LegalDisclaimerSection />
    </PublicMarketingLayout>
  );
}
