// ============================================================================
// CourtAccess Landing Page — Criminal Evidence Intelligence Platform
// Public marketing page for courtaccess.com
// ============================================================================

import { Link } from 'react-router-dom';
import {
  Scale,
  Shield,
  Search,
  FileText,
  Video,
  Clock,
  Eye,
  BarChart3,
  Layers,
  Upload,
  ChevronRight,
  Star,
  CheckCircle2,
  ArrowRight,
  Globe,
  Lock,
  Users,
  Gavel,
  Map,
  Play,
  FileDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, white 2%, transparent 0%)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-8">
            <Scale className="text-amber-400" size={16} />
            <span className="text-amber-300 text-sm font-medium">Criminal Evidence Intelligence Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            The First{' '}
            <span className="text-amber-400">Criminal Evidence Intelligence Platform</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            CourtAccess analyzes police reports, body camera footage, and investigative evidence
            — providing structured analytical tools for legal professionals across the criminal justice system.
          </p>

          {/* Core Benefits */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-10">
            {[
              'Detect potential policy inconsistencies automatically',
              'Reconstruct incidents with interactive 3D trial exhibits',
              'Reveal investigative insights hidden inside evidence',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
                <span className="text-sm sm:text-base">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
            >
              Start Analyzing Your First Case
              <ArrowRight size={20} />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/20"
            >
              <Play size={18} />
              See How It Works
            </a>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pain Point Section
// ---------------------------------------------------------------------------

function PainPointSection() {
  const painPoints = [
    { icon: FileText, text: 'Thousands of pages of reports must be reviewed manually' },
    { icon: Video, text: 'Bodycam footage takes hours to analyze' },
    { icon: Search, text: 'Agency policies are difficult to locate' },
    { icon: Eye, text: 'Potential misconduct may remain undiscovered' },
    { icon: Layers, text: 'Trial exhibits must be built manually' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            What Legal Professionals Face Every Day
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Without CourtAccess:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          {painPoints.map((item) => (
            <div
              key={item.text}
              className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100"
            >
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <item.icon className="text-red-500" size={16} />
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-lg text-slate-500 italic max-w-2xl mx-auto">
          Legal teams often spend weeks analyzing evidence that software can evaluate in minutes.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Solution Section
// ---------------------------------------------------------------------------

function SolutionSection() {
  const capabilities = [
    'Identify agencies involved',
    'Analyze officer actions',
    'Compare conduct to department policies',
    'Detect potential procedural inconsistencies',
    'Generate expert-ready reports',
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            How CourtAccess Changes Case Analysis
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            CourtAccess transforms raw evidence into structured legal intelligence.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 sm:p-12 max-w-3xl mx-auto">
          <p className="text-slate-700 text-lg mb-8 text-center">
            Upload your case evidence and the system can:
          </p>
          <div className="space-y-4">
            {capabilities.map((cap, i) => (
              <div key={cap} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <p className="text-slate-800 text-lg">{cap}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Core Features Section
// ---------------------------------------------------------------------------

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
  highlight?: string;
}

function FeatureCard({ icon: Icon, title, description, items, highlight }: FeatureCardProps) {
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
      {highlight && (
        <div className="mt-5 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-sm text-amber-800">{highlight}</p>
        </div>
      )}
    </div>
  );
}

function CoreFeaturesSection() {
  const features: FeatureCardProps[] = [
    {
      icon: Globe,
      title: 'Policy Intelligence Engine',
      description: 'CourtAccess maintains a growing database of law enforcement policies and procedures.',
      items: [
        'Use-of-force policies',
        'Internal affairs manuals',
        'Training standards',
        'Body camera policies',
        'Officer discipline procedures',
      ],
      highlight: 'If a department\'s policies are unavailable, CourtAccess compares conduct to the California Highway Patrol policy baseline.',
    },
    {
      icon: Upload,
      title: 'Evidence Intelligence Engine',
      description: 'Upload police reports, bodycam video, dashcam footage, audio recordings, and witness statements.',
      items: [
        'Extracts key events automatically',
        'Builds incident timelines',
        'Identifies officer actions',
        'Links evidence across sources',
      ],
    },
    {
      icon: Shield,
      title: 'Policy Compliance Analysis',
      description: 'CourtAccess compares officer conduct to official policy standards.',
      items: [
        'Use-of-force policy inconsistencies',
        'Search and seizure procedural issues',
        'Evidence handling irregularities',
        'Miranda warning timing issues',
      ],
      highlight: 'All findings are presented using neutral investigative language suitable for legal environments.',
    },
    {
      icon: Map,
      title: 'Forensic Reconstruction System',
      description: 'CourtAccess can reconstruct incidents using 3D visual analysis.',
      items: [
        'Scene reconstruction from aerial maps',
        'Officer line-of-sight analysis',
        'Lighting and visibility simulation',
        'Trajectory and impact modeling',
        'Synchronized multi-camera timelines',
      ],
      highlight: 'Attorneys can generate interactive trial exhibits in minutes.',
    },
    {
      icon: Clock,
      title: 'Timeline Intelligence',
      description: 'CourtAccess synchronizes evidence sources to build a unified timeline.',
      items: [
        'When force was applied',
        'When commands were issued',
        'When weapons were drawn',
        'When suspects were restrained',
      ],
      highlight: 'All events are linked directly to the underlying evidence.',
    },
    {
      icon: FileDown,
      title: 'Expert Witness Report Generator',
      description: 'Generate structured investigative reports with evidence citations, policy references, timestamps, and analytical findings.',
      items: [
        'PDF export',
        'Word document export',
        'Trial exhibit packages',
        'Evidence citations with timestamps',
      ],
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Platform Capabilities
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Six integrated systems that transform how legal professionals analyze evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Social Proof Section
// ---------------------------------------------------------------------------

function SocialProofSection() {
  const testimonials = [
    {
      quote: 'CourtAccess uncovered policy inconsistencies in minutes that would have taken our team days to identify.',
      author: 'Criminal Defense Attorney',
    },
    {
      quote: 'The timeline and evidence synchronization tools are unlike anything we have seen in legal technology.',
      author: 'Defense Investigator',
    },
    {
      quote: 'The ability to compare officer actions to department policy is a game-changer.',
      author: 'Trial Attorney',
    },
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Trusted by Legal Professionals
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
              <p className="text-sm font-semibold text-slate-900">— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Authority Section
// ---------------------------------------------------------------------------

function AuthoritySection() {
  const audiences = [
    { icon: Gavel, label: 'Criminal defense attorneys' },
    { icon: Scale, label: 'District attorney offices' },
    { icon: Search, label: 'Investigators' },
    { icon: FileText, label: 'Appellate specialists' },
    { icon: Users, label: 'Expert witnesses' },
    { icon: Shield, label: 'Public defender offices' },
  ];

  const principles = [
    { icon: BarChart3, label: 'Factual neutrality' },
    { icon: Eye, label: 'Evidence traceability' },
    { icon: Shield, label: 'Legally defensible analysis' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Built for the Criminal Justice Ecosystem
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Designed specifically for:</h3>
            <div className="space-y-4">
              {audiences.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <item.icon className="text-slate-600" size={18} />
                  </div>
                  <span className="text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-6">The system prioritizes:</h3>
            <div className="space-y-4">
              {principles.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <item.icon className="text-amber-600" size={18} />
                  </div>
                  <span className="text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ Section
// ---------------------------------------------------------------------------

function FaqSection() {
  const faqs = [
    {
      question: 'How does CourtAccess obtain law enforcement policies?',
      answer: 'CourtAccess collects publicly available policy documents, training manuals, and procedures through official publications, public records requests, and agency websites.',
    },
    {
      question: 'Can CourtAccess analyze body camera footage?',
      answer: 'Yes. The system can analyze video evidence to extract events, identify officer actions, and synchronize footage with reports and other evidence.',
    },
    {
      question: 'Does the system determine that an officer violated policy?',
      answer: 'No. CourtAccess identifies potential policy inconsistencies and presents evidence for legal review. Final determinations remain with attorneys and courts.',
    },
    {
      question: 'Can CourtAccess generate trial exhibits?',
      answer: 'Yes. The system can produce interactive 3D scene reconstructions, timelines, and evidence visualizations suitable for courtroom presentation.',
    },
    {
      question: 'Is the system secure?',
      answer: 'CourtAccess uses JWT authentication, role-based access controls, encrypted storage, security headers, rate limiting, CSRF protection, and strict evidence handling protocols to protect case data.',
    },
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">{faq.question}</h3>
              <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing Section
// ---------------------------------------------------------------------------

function PricingSection() {
  const plans = [
    {
      name: 'Free',
      price: 0,
      pages: '10 pages lifetime',
      credits: '0 AI credits',
      features: ['Basic evidence upload', 'Single case', 'Watermarked exports'],
      cta: 'Get Started Free',
      highlighted: false,
    },
    {
      name: 'Starter',
      price: 39,
      pages: '300 pages/mo',
      credits: '20 AI credits/mo',
      features: ['Contradiction detection', 'Timeline analysis', 'Document archival', '1-year retention'],
      cta: 'Start Starter',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: 129,
      pages: '2,000 pages/mo',
      credits: '100 AI credits/mo',
      features: ['Everything in Starter', 'Doctrine matching', 'Litigation intelligence', 'No watermarks', '2-year retention'],
      cta: 'Go Professional',
      highlighted: true,
    },
    {
      name: 'Advanced Investigator',
      price: 249,
      pages: '6,000 pages/mo',
      credits: '250 AI credits/mo',
      features: ['Everything in Professional', 'Video intelligence', 'Reliability scoring', 'Priority processing', '3-year retention'],
      cta: 'Start Advanced',
      highlighted: false,
    },
    {
      name: 'Litigation Pro',
      price: 399,
      pages: '12,000 pages/mo',
      credits: '500 AI credits/mo',
      features: ['Everything in Advanced', 'Expert witness packages', 'Jury visualization', 'Forensic reconstruction', '5-year retention'],
      cta: 'Start Litigation Pro',
      highlighted: false,
    },
    {
      name: 'Enterprise Firm',
      price: 699,
      pages: '25,000 pages/mo',
      credits: '1,500 AI credits/mo',
      features: ['Everything in Litigation Pro', 'Multi-user accounts', 'API access', 'Dedicated support', '10-year retention'],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  const creditPacks = [
    { credits: 50, price: 25 },
    { credits: 150, price: 60 },
    { credits: 500, price: 175 },
    { credits: 1500, price: 450 },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your caseload. All page limits are cumulative across all your cases.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 ${
                plan.highlighted
                  ? 'bg-slate-900 text-white ring-2 ring-amber-500 shadow-xl scale-105'
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full mb-3">
                  Most Popular
                </span>
              )}
              <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  ${plan.price}
                </span>
                {plan.price > 0 && (
                  <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-gray-500'}`}>/month</span>
                )}
              </div>
              <div className={`text-sm mb-1 ${plan.highlighted ? 'text-slate-300' : 'text-gray-600'}`}>
                {plan.pages}
              </div>
              <div className={`text-sm mb-4 ${plan.highlighted ? 'text-slate-300' : 'text-gray-600'}`}>
                {plan.credits}
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlighted ? 'text-slate-200' : 'text-gray-600'}`}>
                    <span className={plan.highlighted ? 'text-amber-400' : 'text-green-500'}>&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Credit Packs */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Need More AI Credits?</h3>
          <p className="text-gray-600">Purchase credit packs anytime. Credits roll over for 90 days.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {creditPacks.map((pack) => (
            <div key={pack.credits} className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <p className="text-3xl font-bold text-gray-900">{pack.credits.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mb-3">credits</p>
              <p className="text-xl font-bold text-blue-600">${pack.price}</p>
              <p className="text-xs text-gray-400 mt-1">${(pack.price / pack.credits * 100).toFixed(0)}c/credit</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final CTA Section
// ---------------------------------------------------------------------------

function FinalCtaSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Stop Manually Analyzing Evidence
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
          Let CourtAccess help you uncover the facts hidden inside case evidence.
        </p>
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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Navigation Bar
// ---------------------------------------------------------------------------

function LandingNav() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold text-white">CourtAccess</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-slate-300 hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">Features</a>
            <Link to="/for-defense" className="text-sm text-slate-300 hover:text-white transition-colors">For Defense</Link>
            <Link to="/for-prosecutors" className="text-sm text-slate-300 hover:text-white transition-colors">For Prosecutors</Link>
            <Link to="/government" className="text-sm text-slate-300 hover:text-white transition-colors">Government</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function LandingFooter() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <Scale className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-white">CourtAccess</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              The first criminal evidence intelligence platform.
              Built by investigators who understand how cases actually unfold.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a></li>
              <li><Link to="/case-studies" className="text-sm text-slate-400 hover:text-white transition-colors">Case Studies</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Solutions</h4>
            <ul className="space-y-2">
              <li><Link to="/for-defense" className="text-sm text-slate-400 hover:text-white transition-colors">For Defense</Link></li>
              <li><Link to="/for-prosecutors" className="text-sm text-slate-400 hover:text-white transition-colors">For Prosecutors</Link></li>
              <li><Link to="/government" className="text-sm text-slate-400 hover:text-white transition-colors">Government</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact Sales</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Account</h4>
            <ul className="space-y-2">
              <li><Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="text-sm text-slate-400 hover:text-white transition-colors">Create Account</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} CourtAccess. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock size={14} />
            <span>Secured with JWT authentication, RBAC, and encrypted evidence handling</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main Landing Page
// ---------------------------------------------------------------------------

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <HeroSection />
      <PainPointSection />
      <div id="how-it-works">
        <SolutionSection />
      </div>
      <div id="features">
        <CoreFeaturesSection />
      </div>
      <div id="testimonials">
        <SocialProofSection />
      </div>
      <AuthoritySection />
      <div id="pricing">
        <PricingSection />
      </div>
      <div id="faq">
        <FaqSection />
      </div>
      <FinalCtaSection />
      <LandingFooter />
    </div>
  );
}
