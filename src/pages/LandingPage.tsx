// ============================================================================
// CourtAccess Landing Page — Criminal Evidence Intelligence Platform
// Public marketing page for courtaccess.com
// ============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Scale,
  Shield,
  Search,
  FileText,
  Video,
  Clock,
  Eye,
  BarChart3,
  Upload,
  ChevronRight,
  Star,
  CheckCircle2,
  ArrowRight,
  Globe,
  Lock,
  Users,
  Gavel,
  Play,
  Loader2,
} from 'lucide-react';
import { createCheckoutSession } from '../services/caseApi';

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
            <span className="text-amber-300 text-sm font-medium">Built for Criminal Defense Teams</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Your Criminal Case Has Defenses{' '}
            <span className="text-amber-400">You Haven't Found Yet.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl font-semibold text-amber-300 max-w-3xl mx-auto mb-4">
            Making Swiss Cheese Out of California Prosecutor's Cases.
          </p>
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            You get thousands of pages of reports, hours of bodycam footage, and conflicting witness statements.
            CourtAccess reads it all, reconstructs what happened, finds the contradictions, and shows you exactly where the prosecution's narrative falls apart.
          </p>

          {/* Core Benefits */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-10">
            {[
              'Automatically reconstruct incident timelines from all evidence sources',
              'Detect contradictions between reports, video, and witness statements',
              'Identify impeachment opportunities the prosecution hopes you miss',
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
              Start Your First Case Analysis
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
    { icon: FileText, text: 'You get 3,000 pages of discovery two weeks before trial. Where do you even start?' },
    { icon: Video, text: 'The bodycam footage tells a different story than the report — but finding where takes hours.' },
    { icon: Search, text: 'The officer says one thing. The witness says another. The timeline doesn\'t add up.' },
    { icon: Eye, text: 'Contradictions that could win your case are buried on page 847 of a supplement.' },
    { icon: Clock, text: 'Your investigator is juggling six cases. Nobody has time to cross-reference everything.' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Sound Familiar?
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Every defense team hits the same wall.
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
          You shouldn't need a week to find what matters in your own case file.
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
    'Upload your discovery — reports, bodycam, dashcam, witness statements, CAD logs, audio',
    'CourtAccess reads every document and watches every frame of video',
    'The system reconstructs a unified timeline of what actually happened',
    'Contradictions between sources are flagged automatically',
    'You get impeachment-ready questions and a clear picture of the case',
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Upload Your Evidence. Get Answers.
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            CourtAccess does in minutes what used to take your team weeks.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 sm:p-12 max-w-3xl mx-auto">
          <p className="text-slate-700 text-lg mb-8 text-center">
            Here's how it works:
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
      icon: Upload,
      title: 'Evidence Intelligence Engine',
      description: 'Drop in your discovery — police reports, bodycam, dashcam, witness statements, audio, CAD logs — and CourtAccess extracts every meaningful event automatically.',
      items: [
        'Reads and indexes every document in your case file',
        'Watches video frame-by-frame to extract events',
        'Links related evidence across sources',
        'Builds a structured evidence graph you can query',
      ],
      highlight: 'Handles the evidence formats defense teams actually receive: PDF reports, MP4 bodycam, audio recordings, scanned documents.',
    },
    {
      icon: Clock,
      title: 'Automatic Timeline Reconstruction',
      description: 'CourtAccess synchronizes timestamps across all evidence sources and builds a single unified timeline of the incident — so you can see exactly what happened and when.',
      items: [
        'Correlates timestamps from reports, video, CAD, and dispatch logs',
        'Detects clock drift between bodycam and dashcam sources',
        'Shows gaps where evidence is missing or contradictory',
        'Every event links back to the source evidence',
      ],
      highlight: 'When the report says one thing and the bodycam shows another, the timeline makes it obvious.',
    },
    {
      icon: FileText,
      title: 'Narrative Deconstruction',
      description: 'Police reports tell a story. CourtAccess breaks that story into individual factual claims, then checks each one against the actual evidence.',
      items: [
        'Extracts every factual claim from officer narratives',
        'Normalizes claims into structured events (who did what, when)',
        'Validates each claim against bodycam, witnesses, and other sources',
        'Flags unsupported or contradicted claims for cross-examination',
      ],
      highlight: 'Stop reading reports at face value. Start verifying every sentence.',
    },
    {
      icon: Eye,
      title: 'Contradiction Detection',
      description: 'The system cross-references every claim, event, and timestamp across your entire case file to find inconsistencies the prosecution hopes you won\'t catch.',
      items: [
        'Officer A says X happened at 10:04. The bodycam shows it at 10:11.',
        'The report says the suspect was aggressive. Two witnesses say otherwise.',
        'Dispatch logs show a 7-minute gap no report accounts for.',
        'Generates impeachment questions ready for cross-examination.',
      ],
      highlight: 'Every contradiction includes the exact evidence sources so you can verify it yourself.',
    },
    {
      icon: Globe,
      title: 'Policy Intelligence Engine',
      description: 'CourtAccess maintains a growing database of law enforcement policies so you can compare what officers did against what their own department requires.',
      items: [
        'Use-of-force policies and escalation standards',
        'Body camera activation requirements',
        'Search, seizure, and Miranda timing protocols',
        'Falls back to CHP baseline when department policies are unavailable',
      ],
    },
    {
      icon: Shield,
      title: 'Case Intelligence Dashboard',
      description: 'Everything your defense team needs in one place — structured, searchable, and ready for trial preparation.',
      items: [
        'Evidence graph visualization showing how sources connect',
        'Filterable contradiction and impeachment lists',
        'Timeline viewer with multi-source overlay',
        'One-click evidence navigation from any finding',
      ],
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Six Engines That Find What Matters
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Each system works independently. Together, they give your defense team a complete picture of the case — contradictions, timelines, and impeachment opportunities included.
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
      quote: 'I uploaded 2,800 pages of discovery and had a complete timeline with contradictions flagged in under an hour. My investigator would have needed two weeks.',
      author: 'Criminal Defense Attorney',
    },
    {
      quote: 'The narrative deconstruction caught three claims in the officer\'s report that directly contradicted the bodycam. Those became our cross-examination.',
      author: 'Defense Investigator',
    },
    {
      quote: 'We used to manually cross-reference reports against video. CourtAccess does it automatically and catches things we would have missed.',
      author: 'Trial Preparation Team Lead',
    },
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Defense Teams Are Already Using This
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
    { icon: Gavel, label: 'Criminal defense attorneys handling complex cases' },
    { icon: Search, label: 'Defense investigators managing multiple case files' },
    { icon: Users, label: 'Trial preparation teams coordinating discovery review' },
    { icon: Shield, label: 'Public defender offices with overwhelming caseloads' },
  ];

  const principles = [
    { icon: BarChart3, label: 'Every finding links to source evidence — nothing is asserted without proof' },
    { icon: Eye, label: 'Neutral analysis language suitable for legal proceedings' },
    { icon: Lock, label: 'Tenant-isolated, encrypted, role-based access for case security' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Built for Defense Teams. Nobody Else.
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            CourtAccess was designed by people who understand how criminal cases actually work — the evidence you get, the deadlines you face, and the contradictions you need to find.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Who it's for:</h3>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-6">How we handle your evidence:</h3>
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
      question: 'What types of evidence can I upload?',
      answer: 'Police reports (PDF), bodycam and dashcam video (MP4), audio recordings, witness statements, CAD/dispatch logs, scanned documents, and investigator reports. If your jurisdiction produces it, CourtAccess can probably process it.',
    },
    {
      question: 'How does the timeline reconstruction work?',
      answer: 'CourtAccess extracts timestamped events from every evidence source — reports, video, audio, dispatch — then synchronizes them into a single timeline. It detects clock drift between video sources and highlights gaps or conflicts automatically.',
    },
    {
      question: 'What is narrative deconstruction?',
      answer: 'The system breaks officer narratives into individual factual claims ("Officer arrived at 10:04," "Suspect became aggressive"), normalizes each claim, then validates it against bodycam footage, witness statements, and other evidence. Claims that contradict the evidence are flagged for cross-examination.',
    },
    {
      question: 'Does CourtAccess tell me the officer was wrong?',
      answer: 'No. CourtAccess identifies contradictions and inconsistencies between evidence sources using neutral language. It shows you what the evidence says and where sources disagree. Legal conclusions remain with you and the court.',
    },
    {
      question: 'Is my case data secure?',
      answer: 'Every account is tenant-isolated — your cases, evidence, and analysis are completely separated from other users. All data is encrypted, access is role-based, and the system enforces strict evidence handling protocols.',
    },
    {
      question: 'How many pages can I process?',
      answer: 'Depends on your plan. Starter handles 300 pages/month (enough for a simple case). Professional handles 2,000 pages/month. Advanced Investigator handles 6,000. Enterprise handles 25,000+. All limits are cumulative across cases.',
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

// Map plan names to backend plan IDs for Stripe checkout
const PLAN_ID_MAP: Record<string, string> = {
  'Free': 'FREE',
  'Starter': 'STARTER',
  'Professional': 'PROFESSIONAL',
  'Advanced Investigator': 'ADVANCED_INVESTIGATOR',
  'Litigation Pro': 'LITIGATION_INTELLIGENCE_PRO',
  'Enterprise Firm': 'ENTERPRISE_FIRM',
};

const CREDIT_PACK_ID_MAP: Record<number, string> = {
  50: 'CREDIT_PACK_50',
  150: 'CREDIT_PACK_150',
  500: 'CREDIT_PACK_500',
  1500: 'CREDIT_PACK_1500',
};

function PricingSection() {
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreditPackPurchase = async (credits: number) => {
    const token = localStorage.getItem('court-access-token');
    if (!token) {
      navigate('/register');
      return;
    }
    const packId = CREDIT_PACK_ID_MAP[credits];
    if (!packId) return;
    setCheckingOut(`credits-${credits}`);
    setCheckoutError(null);
    try {
      const result = await createCheckoutSession(packId);
      if (result.url) {
        window.location.href = result.url;
      } else {
        setCheckoutError('Unable to start checkout. Please try again or contact support.');
      }
    } catch {
      setCheckoutError('Checkout failed. Please try again or contact support.');
    } finally {
      setCheckingOut(null);
    }
  };

  const handlePlanSelect = async (planName: string, price: number) => {
    // Free plan → go to register
    if (price === 0) {
      navigate('/register');
      return;
    }
    // Enterprise → contact sales
    if (planName === 'Enterprise Firm') {
      navigate('/contact-sales');
      return;
    }
    // Check if user is logged in
    const token = localStorage.getItem('court-access-token');
    if (!token) {
      navigate('/register');
      return;
    }
    // Create Stripe checkout session
    const planId = PLAN_ID_MAP[planName] || 'STARTER';
    setCheckingOut(planName);
    setCheckoutError(null);
    try {
      const result = await createCheckoutSession(planId);
      if (result.url) {
        window.location.href = result.url;
      } else {
        setCheckoutError('Unable to start checkout. Please try again or contact support.');
      }
    } catch {
      setCheckoutError('Checkout failed. Please try again or contact support.');
    } finally {
      setCheckingOut(null);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: 0,
      pages: '10 pages (lifetime)',
      credits: 'No AI credits',
      bestFor: 'See how CourtAccess structures case evidence',
      features: ['Upload one case', 'Evidence graph view', 'Watermarked exports', '90-day retention'],
      cta: 'Try It Free',
      highlighted: false,
    },
    {
      name: 'Starter',
      price: 39,
      pages: '300 pages/mo',
      credits: '20 AI credits/mo',
      bestFor: 'Solo practitioners, 1\u20132 active cases',
      features: ['Contradiction detection', 'Timeline reconstruction', 'Document archival', '200 MB upload limit', '1-year retention'],
      cta: 'Start Starter',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: 129,
      pages: '2,000 pages/mo',
      credits: '100 AI credits/mo',
      bestFor: 'Attorneys running 3\u20135 cases with full discovery',
      features: ['Timeline + narrative deconstruction', 'Contradiction detection across sources', 'Doctrine matching', 'Clean exports (no watermarks)', '500 MB uploads \u00b7 2-year retention'],
      cta: 'Go Professional',
      highlighted: true,
    },
    {
      name: 'Advanced Investigator',
      price: 249,
      pages: '6,000 pages/mo',
      credits: '250 AI credits/mo',
      bestFor: 'Defense investigators, multi-defendant cases',
      features: ['Video intelligence (bodycam/dashcam)', 'Reliability scoring', 'Priority processing queue', '1 GB uploads \u00b7 3-year retention'],
      cta: 'Start Advanced',
      highlighted: false,
    },
    {
      name: 'Litigation Pro',
      price: 399,
      pages: '12,000 pages/mo',
      credits: '500 AI credits/mo',
      bestFor: 'Trial teams with large discovery volumes',
      features: ['Forensic reconstruction', 'Impeachment package assembly', 'Jury-ready exhibit generation', '2 GB uploads \u00b7 5-year retention'],
      cta: 'Start Litigation Pro',
      highlighted: false,
    },
    {
      name: 'Enterprise Firm',
      price: 699,
      pages: '25,000 pages/mo',
      credits: '1,500 AI credits/mo',
      bestFor: 'Firms & public defender offices',
      features: ['Multi-user accounts (RBAC)', 'API integration', 'Dedicated support', '5 GB uploads \u00b7 10-year retention'],
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
            Plans That Match Your Caseload
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every plan includes evidence upload, timeline reconstruction, and contradiction detection. Page limits are cumulative across all your cases.
          </p>
        </div>

        {checkoutError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {checkoutError}
          </div>
        )}

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
              <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  ${plan.price}
                </span>
                {plan.price > 0 && (
                  <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-gray-500'}`}>/month</span>
                )}
              </div>
              <p className={`text-xs font-medium mb-3 ${plan.highlighted ? 'text-amber-400' : 'text-blue-600'}`}>
                {plan.bestFor}
              </p>
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
              <button
                onClick={() => handlePlanSelect(plan.name, plan.price)}
                disabled={checkingOut === plan.name}
                className={`block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                } disabled:opacity-50`}
              >
                {checkingOut === plan.name ? (
                  <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Processing...</span>
                ) : plan.cta}
              </button>
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
              <button
                onClick={() => handleCreditPackPurchase(pack.credits)}
                disabled={checkingOut === `credits-${pack.credits}`}
                className="mt-4 w-full py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
              >
                {checkingOut === `credits-${pack.credits}` ? (
                  <span className="inline-flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Processing...</span>
                ) : 'Buy Credits'}
              </button>
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
          Your Next Case Has Contradictions You Haven't Found Yet
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
          Upload your discovery. Let CourtAccess reconstruct the timeline, deconstruct the narrative, and surface the inconsistencies that matter.
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
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-slate-300 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white font-medium transition-colors hidden sm:inline"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors"
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
        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-white/10 pt-4 space-y-3">
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">How It Works</a>
            <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Features</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Pricing</a>
            <a href="#faq" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">FAQ</a>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Sign In</Link>
          </div>
        )}
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
              Criminal evidence intelligence for defense teams.
              Upload your discovery. Find the contradictions. Win the case.
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
            <h4 className="text-sm font-semibold text-white mb-4">For Defense Teams</h4>
            <ul className="space-y-2">
              <li><a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#faq" className="text-sm text-slate-400 hover:text-white transition-colors">FAQ</a></li>
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

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <div className="pt-16">
        <PricingSection />
      </div>
      <LandingFooter />
    </div>
  );
}

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
