// ============================================
// Court Access — Marketing Landing Page
// Conversion-optimized, mobile-first, legal-tech aesthetic
// ============================================

import { Link } from 'react-router-dom';
import {
  Scale,
  Upload,
  FileSearch,
  Shield,
  CheckCircle,
  ArrowRight,
  Lock,
  Zap,
  BarChart3,
  Users,
  Star,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../../utils/analytics';

// ---- Reusable Section Components ----

function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center">
              <Scale className="text-amber-400" size={18} />
            </div>
            <span className="text-lg font-semibold text-slate-900 tracking-tight">Court Access</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              onClick={() => trackEvent('cta_click', { location: 'nav', label: 'Start Free Analysis' })}
              className="text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
            >
              Start Free Analysis
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="pt-28 pb-20 sm:pt-36 sm:pb-28 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-medium mb-6 border border-amber-100">
            <Zap size={12} />
            Free analysis for your first document
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
            Understand Your Court Records{' '}
            <span className="text-amber-600">Instantly</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Upload court documents and receive structured analysis in seconds
            using deterministic legal intelligence. No guesswork. No interpretation.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              onClick={() => trackEvent('cta_click', { location: 'hero', label: 'Start Free Analysis' })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-8 py-3.5 rounded-xl font-medium text-base hover:bg-slate-700 transition-colors shadow-lg shadow-slate-800/10"
            >
              Start Free Analysis
              <ArrowRight size={18} />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-8 py-3.5 rounded-xl font-medium text-base border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            No credit card required. 1 free document analysis included.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Court records shouldn't be this hard to understand
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Defense teams spend hours manually reviewing documents, missing critical details
            buried in hundreds of pages. Important deadlines slip. Evidence goes unnoticed.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              stat: '12+ hrs',
              label: 'Average time to manually review a single case file',
            },
            {
              stat: '23%',
              label: 'Of critical details missed in manual document review',
            },
            {
              stat: '4x',
              label: 'More filings per attorney than a decade ago',
            },
          ].map((item) => (
            <div key={item.stat} className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="text-3xl font-bold text-slate-800">{item.stat}</div>
              <p className="mt-2 text-sm text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Structured analysis, not AI opinions
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Court Access maps court documents into structured, verifiable data.
            Every output is deterministic, auditable, and traceable back to the source.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {[
            { icon: CheckCircle, title: 'Deterministic', desc: 'Same input always produces the same output. No hallucination, no randomness.' },
            { icon: Lock, title: 'Cryptographically Verified', desc: 'Every document hash-chained with SHA-256 for tamper-proof integrity.' },
            { icon: FileSearch, title: 'Structurally Mapped', desc: 'Charges, evidence, filings, and deadlines extracted automatically.' },
            { icon: Shield, title: 'Tenant Isolated', desc: 'Each case protected by strict tenant boundaries. Your data stays yours.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 p-6 bg-white rounded-xl border border-gray-100">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <item.icon className="text-amber-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Upload,
      title: 'Upload Court Documents',
      description: 'PDF, DOCX, or transcripts. Drag and drop or browse. Secure upload with integrity hashing on ingestion.',
    },
    {
      icon: FileSearch,
      title: 'Automated Legal Structure Mapping',
      description: 'Charges, evidence, filings, witnesses, and deadlines detected automatically from document content.',
    },
    {
      icon: Shield,
      title: 'Secure Tenant Isolation',
      description: 'Each case protected by cryptographic verification. Strict multi-tenant boundaries enforced at every layer.',
    },
    {
      icon: BarChart3,
      title: 'Case Analytics Dashboard',
      description: 'Visual overview of case status, document processing, filing deadlines, and analysis completion metrics.',
    },
    {
      icon: Lock,
      title: 'Tamper-Proof Audit Trail',
      description: 'Every action logged with immutable hash chains. Full reproducibility for court admissibility.',
    },
    {
      icon: Users,
      title: 'Role-Based Team Access',
      description: 'Attorneys, investigators, staff, and clients each see exactly what they need. Permission-controlled views.',
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Everything you need to analyze court records
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Built for defense attorneys, investigators, and legal teams who need structured, reliable analysis.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm border border-gray-100 group-hover:border-amber-200 transition-colors">
                <feature.icon className="text-slate-700 group-hover:text-amber-600 transition-colors" size={22} />
              </div>
              <h3 className="font-semibold text-slate-900 text-lg">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      title: 'Upload your document',
      description: 'Drop a PDF, DOCX, or transcript. Court Access hashes it on ingestion for integrity verification.',
    },
    {
      step: '02',
      title: 'Automated analysis begins',
      description: 'The document is parsed, classified, and structurally mapped. Charges, evidence, and filings are extracted.',
    },
    {
      step: '03',
      title: 'Review structured results',
      description: 'View organized case data in your dashboard. Every finding linked back to source text with page references.',
    },
    {
      step: '04',
      title: 'Export or share',
      description: 'Generate court-ready packets, share with your team, or export structured data for your case management system.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            How it works
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            From document upload to structured analysis in under a minute.
          </p>
        </div>
        <div className="max-w-3xl mx-auto space-y-0">
          {steps.map((item, index) => (
            <div key={item.step} className="flex gap-6 group">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {item.step}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px h-full bg-gray-200 my-2" />
                )}
              </div>
              <div className="pb-12">
                <h3 className="font-semibold text-slate-900 text-lg">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoTestimonialCard({ video, name, role, quote }: { video: string; name: string; role: string; quote: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl overflow-hidden group">
      <div className="relative cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={video}
          className="w-full aspect-[9/16] object-cover"
          playsInline
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
        />
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity group-hover:bg-black/30">
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-slate-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex gap-0.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="text-amber-400 fill-amber-400" size={14} />
          ))}
        </div>
        <p className="text-gray-700 text-sm leading-relaxed mb-3">&ldquo;{quote}&rdquo;</p>
        <div>
          <div className="font-medium text-slate-900 text-sm">{name}</div>
          <div className="text-xs text-gray-500">{role}</div>
        </div>
      </div>
    </div>
  );
}

function TestimonialsSection() {
  const videoTestimonials = [
    {
      video: '/videos/testimonial-1.mp4',
      name: 'Attorney Testimonial',
      role: 'Defense Attorney',
      quote: 'If you\'re watching this, you or someone you love needs help navigating the court system. Court Access changed how I prepare for every case.',
    },
    {
      video: '/videos/testimonial-2.mp4',
      name: 'Client Story',
      role: 'Former Defendant',
      quote: 'When I was charged with a felony, my whole world turned upside down. Having structured analysis of my court records made all the difference.',
    },
    {
      video: '/videos/testimonial-3.mp4',
      name: 'Michael',
      role: 'Small Business Owner',
      quote: 'As a small business owner facing legal challenges, I needed to understand my court documents fast. Court Access gave me clarity when I needed it most.',
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Real stories from real people
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Hear directly from those who have used Court Access to navigate the legal system.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {videoTestimonials.map((t) => (
            <VideoTestimonialCard
              key={t.name}
              video={t.video}
              name={t.name}
              role={t.role}
              quote={t.quote}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Try Court Access with one free document analysis.',
      features: [
        '1 document analysis',
        'Up to 10 pages',
        'Basic structure mapping',
        'Single user',
      ],
      cta: 'Start Free',
      ctaStyle: 'border border-gray-200 text-slate-800 hover:bg-gray-50',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: '$99',
      period: '/month',
      description: 'For individual attorneys and small practices.',
      features: [
        'Unlimited document analysis',
        'Up to 500 pages per document',
        'Full structure mapping',
        'Case analytics dashboard',
        'Export court-ready packets',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      ctaStyle: 'bg-slate-800 text-white hover:bg-slate-700 shadow-lg shadow-slate-800/10',
      highlighted: true,
    },
    {
      name: 'Team',
      price: '$249',
      period: '/month',
      description: 'For firms and organizations.',
      features: [
        'Everything in Professional',
        'Up to 10 team members',
        'Role-based access control',
        'Cross-case indexing',
        'Audit trail & compliance',
        'Dedicated account manager',
      ],
      cta: 'Contact Sales',
      ctaStyle: 'border border-gray-200 text-slate-800 hover:bg-gray-50',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Start with a free analysis. Upgrade when you're ready.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-8 rounded-2xl ${
                plan.highlighted
                  ? 'bg-white border-2 border-slate-800 shadow-xl relative'
                  : 'bg-white border border-gray-100'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="text-sm font-medium text-gray-500 mb-2">{plan.name}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">{plan.description}</p>
              <Link
                to="/signup"
                onClick={() => trackEvent('cta_click', { location: 'pricing', plan: plan.name })}
                className={`mt-6 block text-center py-2.5 rounded-xl font-medium text-sm transition-colors ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={14} />
                    {feature}
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

function CTASection() {
  return (
    <section className="py-20 bg-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Ready to understand your court records?
        </h2>
        <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
          Upload your first document free. No credit card required.
          See structured analysis in under a minute.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            onClick={() => trackEvent('cta_click', { location: 'bottom_cta', label: 'Start Free Analysis' })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-8 py-3.5 rounded-xl font-medium text-base hover:bg-amber-400 transition-colors"
          >
            Start Free Analysis
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/signup"
            onClick={() => trackEvent('cta_click', { location: 'bottom_cta', label: 'Create Account' })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 text-white px-8 py-3.5 rounded-xl font-medium text-base border border-white/20 hover:bg-white/20 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                <Scale className="text-amber-400" size={16} />
              </div>
              <span className="text-sm font-semibold text-white">Court Access</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Structured court record analysis platform. Deterministic. Auditable. Secure.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-xs text-slate-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-xs text-slate-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="text-xs text-slate-400 hover:text-white transition-colors">How It Works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/privacy" className="text-xs text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-xs text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/security" className="text-xs text-slate-400 hover:text-white transition-colors">Security</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Support</h4>
            <ul className="space-y-2">
              <li><a href="mailto:support@courtaccess.net" className="text-xs text-slate-400 hover:text-white transition-colors">support@courtaccess.net</a></li>
              <li><Link to="/about" className="text-xs text-slate-400 hover:text-white transition-colors">About</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Court Access. All rights reserved.</p>
          <p className="text-xs text-slate-500">AI-generated insights are not legal advice.</p>
        </div>
      </div>
    </footer>
  );
}

// ---- Main Landing Page ----

export function LandingPage() {
  useEffect(() => {
    trackEvent('landing_page_view');
    document.title = 'Court Access — Court Record Analysis Platform';

    // Set meta tags
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        if (name.startsWith('og:')) {
          el.setAttribute('property', name);
        } else {
          el.setAttribute('name', name);
        }
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', 'Upload court documents and receive structured analysis in seconds. Deterministic legal intelligence for defense attorneys, investigators, and legal teams.');
    setMeta('og:title', 'Court Access — Court Record Analysis Platform');
    setMeta('og:description', 'Upload court documents and receive structured analysis in seconds using deterministic legal intelligence.');
    setMeta('og:type', 'website');
    setMeta('og:url', 'https://courtaccess.net');

    // Schema markup
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Court Access',
      description: 'Structured court record analysis platform for legal professionals.',
      applicationCategory: 'LegalService',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier: 1 document, 10 pages',
      },
    });
    document.head.appendChild(schema);

    return () => {
      document.head.removeChild(schema);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
