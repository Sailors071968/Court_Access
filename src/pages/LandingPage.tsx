// ============================================================================
// CourtAccess Landing Page — Criminal Case Intelligence Platform
// courtaccess.net homepage
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Shield,
  Bell,
  Eye,
  Users,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Lock,
  Mail,
  MessageSquare,
  BarChart3,
  Clock,
  AlertTriangle,
  ChevronRight,
  Minus,
  Check,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Color tokens (Deep Navy / Slate Gray / Gold-Amber / White)
// ---------------------------------------------------------------------------
// Primary: bg-[#0f172a] (navy-950)  text-[#0f172a]
// Secondary: slate-500/600
// Accent: amber-500 / amber-400
// Surfaces: white, slate-50
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
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">CourtAccess</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">How It Works</a>
            <a href="#discover" className="text-sm text-slate-400 hover:text-white transition-colors">Intelligence</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
            <a href="#who" className="text-sm text-slate-400 hover:text-white transition-colors">Who Uses It</a>
          </div>

          {/* Actions */}
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
              Start Monitoring
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
            <a href="#discover" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Intelligence</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Pricing</a>
            <a href="#who" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Who Uses It</a>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-300 hover:text-white py-1">Login</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// SECTION 1 — Hero
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="relative bg-[#0f172a] overflow-hidden pt-24">
      {/* Subtle grid pattern */}
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
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
            Your Criminal Case Has Information{' '}
            <span className="text-amber-400">You Haven't Seen Yet.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            CourtAccess continuously monitors court filings, analyzes case activity,
            identifies contradictions, tracks evidence developments, and delivers
            criminal case intelligence directly to you.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/20"
            >
              Start Monitoring My Case
              <ArrowRight size={20} />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium px-8 py-4 rounded-xl text-lg transition-colors border border-white/10"
            >
              See How It Works
            </a>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { icon: Eye, label: 'Court Monitoring' },
              { icon: Bell, label: 'Filing Alerts' },
              { icon: Search, label: 'Evidence Intelligence' },
              { icon: FileText, label: 'Attorney Reports' },
              { icon: MessageSquare, label: 'SMS + Email Notifications' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-slate-400 text-sm">
                <item.icon size={15} className="text-amber-500/70" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 2 — How CourtAccess Works (3 steps)
// ---------------------------------------------------------------------------

function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'We Monitor Your Case',
      description:
        'CourtAccess checks participating courts on a continuous schedule for new filings and case activity.',
      icon: Eye,
    },
    {
      number: '02',
      title: 'We Analyze New Information',
      description:
        'Court documents are processed and organized into timelines, evidence records, contradiction tracking, and intelligence reports.',
      icon: BarChart3,
    },
    {
      number: '03',
      title: 'You Receive Updates',
      description:
        'SMS and email notifications are delivered whenever significant developments occur.',
      icon: Bell,
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            How CourtAccess Works
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Three steps. Continuous case intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <div key={step.number} className="relative text-center">
              {/* Connector line (desktop only) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-slate-200" />
              )}

              <div className="relative inline-flex items-center justify-center w-24 h-24 bg-[#0f172a] rounded-2xl mb-6 shadow-lg">
                <step.icon className="text-amber-400" size={32} />
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-amber-500 rounded-full text-[#0f172a] text-xs font-bold flex items-center justify-center">
                  {step.number}
                </span>
              </div>

              <h3 className="text-xl font-bold text-[#0f172a] mb-3">{step.title}</h3>
              <p className="text-slate-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 3 — What CourtAccess Can Discover (4 cards)
// ---------------------------------------------------------------------------

function DiscoverSection() {
  const cards = [
    {
      icon: FileText,
      title: 'New Court Filings',
      description: 'Know when documents are added to your case.',
      color: 'bg-blue-50 text-blue-600',
      border: 'border-blue-100',
    },
    {
      icon: AlertTriangle,
      title: 'Evidence Gaps',
      description: 'Identify areas where supporting evidence may be incomplete.',
      color: 'bg-amber-50 text-amber-600',
      border: 'border-amber-100',
    },
    {
      icon: Search,
      title: 'Contradiction Tracking',
      description: 'Surface conflicting statements and inconsistent records.',
      color: 'bg-red-50 text-red-600',
      border: 'border-red-100',
    },
    {
      icon: Shield,
      title: 'Defense Opportunity Identification',
      description: 'Highlight issues requiring attorney review and investigation.',
      color: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-100',
    },
  ];

  return (
    <section id="discover" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            What CourtAccess Can Discover
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Continuous intelligence across every aspect of your criminal case.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`bg-white rounded-2xl p-6 border ${card.border} shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center mb-5`}>
                <card.icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#0f172a] mb-2">{card.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-10 max-w-lg mx-auto italic">
          CourtAccess does not promise legal outcomes, dismissal, or acquittal. All information is provided for review purposes only.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 4 — Live Dashboard Preview
// ---------------------------------------------------------------------------

function DashboardPreviewSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Your Case Intelligence Dashboard
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Everything organized in one place — timelines, filings, evidence, contradictions, and notifications.
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="max-w-5xl mx-auto bg-[#0f172a] rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-5 py-3 bg-[#1e293b] border-b border-slate-700/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-slate-500 ml-3">courtaccess.net/dashboard</span>
          </div>

          {/* Dashboard body */}
          <div className="p-6 sm:p-8">
            {/* Top stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'New Filings', value: '3', sub: 'this week' },
                { label: 'Contradictions', value: '7', sub: 'detected' },
                { label: 'Evidence Items', value: '24', sub: 'tracked' },
                { label: 'Next Hearing', value: 'Jun 18', sub: '9:00 AM' },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/30">
                  <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Recent filings */}
              <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/30">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <FileText size={14} className="text-amber-400" />
                  Recent Filings
                </h4>
                <div className="space-y-3">
                  {[
                    { name: 'Motion to Suppress Evidence', date: 'Jun 2' },
                    { name: 'Prosecution Witness List', date: 'May 28' },
                    { name: 'Lab Analysis Report', date: 'May 22' },
                  ].map((filing) => (
                    <div key={filing.name} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{filing.name}</span>
                      <span className="text-xs text-slate-500">{filing.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contradictions */}
              <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/30">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-400" />
                  Contradictions Found
                </h4>
                <div className="space-y-3">
                  {[
                    { text: 'Officer timeline vs. dispatch log', severity: 'High' },
                    { text: 'Witness A vs. Witness B statement', severity: 'High' },
                    { text: 'Report narrative vs. bodycam', severity: 'Med' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{item.text}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.severity === 'High'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Case timeline bar */}
            <div className="mt-4 bg-[#1e293b] rounded-xl p-5 border border-slate-700/30">
              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Clock size={14} className="text-amber-400" />
                Case Timeline
              </h4>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {[
                  { label: 'Arrest', active: true },
                  { label: 'Arraignment', active: true },
                  { label: 'Discovery', active: true },
                  { label: 'Motions', active: true },
                  { label: 'Pre-Trial', active: false },
                  { label: 'Trial', active: false },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.active
                        ? 'bg-amber-500 text-[#0f172a]'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {i + 1}
                    </div>
                    <span className={`text-xs ${step.active ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                    {i < 5 && <Minus size={12} className="text-slate-600 mx-1" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 5 — Who Uses CourtAccess
// ---------------------------------------------------------------------------

function WhoUsesSection() {
  const audiences = [
    {
      icon: Users,
      title: 'Defendants',
      description: 'Stay informed about developments in your criminal case.',
    },
    {
      icon: Shield,
      title: 'Families',
      description: 'Monitor important case activity and court filings.',
    },
    {
      icon: Briefcase,
      title: 'Attorneys',
      description: 'Receive organized intelligence and reporting support.',
    },
    {
      icon: Search,
      title: 'Investigators',
      description: 'Track case developments and supporting records.',
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
// SECTION 6 — Pricing
// ---------------------------------------------------------------------------

function PricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            No hidden fees. No long-term contracts. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Setup Fee */}
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <p className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-2">One-Time</p>
            <h3 className="text-3xl font-extrabold text-[#0f172a] mb-1">$275</h3>
            <p className="text-slate-500 mb-6">Setup Fee</p>
            <ul className="space-y-3">
              {['Case setup', 'Initial review', 'Monitoring activation'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Monthly */}
          <div className="bg-[#0f172a] rounded-2xl p-8 border border-slate-700/50 shadow-xl">
            <p className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-2">Monthly</p>
            <h3 className="text-3xl font-extrabold text-white mb-1">$75</h3>
            <p className="text-slate-400 mb-6">Per Month</p>
            <ul className="space-y-3">
              {[
                'Court monitoring',
                'Filing alerts',
                'SMS notifications',
                'Email notifications',
                'Intelligence reporting',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-bold px-10 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/20"
          >
            Start Monitoring Today
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SECTION 7 — Why CourtAccess (comparison table)
// ---------------------------------------------------------------------------

function WhyCourtAccessSection() {
  const rows = [
    { feature: 'Court monitoring', traditional: false, courtaccess: true },
    { feature: 'Awareness speed', traditional: 'Delayed', courtaccess: 'Immediate' },
    { feature: 'Filing tracking', traditional: 'Manual checking', courtaccess: 'Automated alerts' },
    { feature: 'Record organization', traditional: 'Fragmented', courtaccess: 'Structured intelligence' },
    { feature: 'Notifications', traditional: 'None', courtaccess: 'SMS + Email' },
    { feature: 'Reporting', traditional: 'Manual', courtaccess: 'Continuous & automated' },
  ];

  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
            Why CourtAccess
          </h2>
        </div>

        <div className="max-w-3xl mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-3 bg-[#0f172a] text-white text-sm font-semibold">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 text-center border-l border-slate-700/50">Traditional Approach</div>
            <div className="px-6 py-4 text-center border-l border-slate-700/50 bg-amber-500/10 text-amber-400">CourtAccess</div>
          </div>

          {/* Rows */}
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
// SECTION 8 — Legal Disclaimer
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
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

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Home</a></li>
              <li><a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a></li>
              <li><Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
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
      <div id="how-it-works-anchor">
        <HowItWorksSection />
      </div>
      <DiscoverSection />
      <DashboardPreviewSection />
      <WhoUsesSection />
      <PricingSection />
      <WhyCourtAccessSection />
      <LegalDisclaimerSection />
      <LandingFooter />
    </div>
  );
}
