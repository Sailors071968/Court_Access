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
  ChevronDown,
  Send,
  MessageSquare,
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
            <a href="#faq" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
            <a href="#contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Contact</a>
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
            using deterministic legal intelligence.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    <div ref={containerRef} className="bg-slate-50 rounded-2xl overflow-hidden group">
      <div className="relative cursor-pointer" onClick={togglePlay}>
        {isVisible ? (
          <video
            ref={videoRef}
            src={video}
            className="w-full aspect-[9/16] object-cover"
            playsInline
            preload="metadata"
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full aspect-[9/16] bg-slate-200 animate-pulse" />
        )}
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
      video: 'https://pub-5902a0d1736f45128ddd003d46626528.r2.dev/testimonials/testimonial-1.mp4',
      name: 'David R.',
      role: 'Criminal Defense Attorney',
      quote: 'Court Access changed how I review case files. Instead of digging through hundreds of pages, I can immediately see the structure of the case and where the important issues are.',
    },
    {
      video: 'https://pub-5902a0d1736f45128ddd003d46626528.r2.dev/testimonials/testimonial-2.mp4',
      name: 'Sarah M.',
      role: 'Former Defendant',
      quote: 'When I was charged with a felony, my entire life felt like it was falling apart. Seeing my court records organized and explained helped me understand what was actually happening in my case.',
    },
    {
      video: 'https://pub-5902a0d1736f45128ddd003d46626528.r2.dev/testimonials/testimonial-3.mp4',
      name: 'Michael T.',
      role: 'Small Business Owner',
      quote: 'I was dealing with a legal dispute and had no idea how to make sense of the documents. Court Access gave me clarity in minutes.',
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

// ---- FAQ Section ----

const faqItems = [
  {
    q: 'What is CourtAccess?',
    a: 'CourtAccess is a structured court record analysis platform that helps defense attorneys, investigators, and legal teams understand court documents quickly. Upload documents and receive deterministic, auditable analysis in seconds.',
  },
  {
    q: 'Is CourtAccess a law firm?',
    a: 'No. CourtAccess is a legal technology platform, not a law firm. We do not provide legal advice, representation, or attorney-client relationships. Our platform provides structured analysis tools for legal professionals.',
  },
  {
    q: 'How secure are uploaded documents?',
    a: 'Every document is hashed with SHA-256 on upload, creating a tamper-proof cryptographic fingerprint. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We maintain an immutable audit trail of all access.',
  },
  {
    q: 'Who can access my files?',
    a: 'Only authorized users within your tenant can access your files. CourtAccess enforces strict tenant isolation at the database level. No cross-tenant data access is possible by design.',
  },
  {
    q: 'What file types are supported?',
    a: 'We support documents (PDF, DOC, DOCX, TXT, RTF, CSV), images (JPG, PNG, HEIC, TIFF, BMP, WEBP), audio (MP3, WAV, M4A, AAC, OGG, FLAC), and video (MP4, MOV, AVI, MKV, WEBM) evidence files.',
  },
  {
    q: 'How does pricing work?',
    a: 'We offer a free tier with 1 document analysis (up to 10 pages). Professional plans start at $99/month for unlimited analysis. Team plans at $249/month include collaboration features and role-based access control.',
  },
  {
    q: 'Are my documents stored permanently?',
    a: 'Documents are retained according to your plan and preferences. You can delete files at any time. We maintain cryptographic proof of document integrity even after deletion for audit purposes.',
  },
  {
    q: 'Can multiple attorneys collaborate on a case?',
    a: 'Yes. Team plans support up to 10 team members with role-based access control. Attorneys, investigators, staff, and clients each see exactly what they need with permission-controlled views.',
  },
  {
    q: 'How does CourtAccess analyze documents?',
    a: 'CourtAccess uses deterministic analysis — not probabilistic AI. Documents are parsed, classified, and structurally mapped. Charges, evidence, filings, witnesses, and deadlines are extracted automatically. Same input always produces the same output.',
  },
  {
    q: 'Is my data encrypted?',
    a: 'Yes. All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Document hashes use SHA-256 for integrity verification. We employ a dual-hash system for tamper detection.',
  },
  {
    q: 'What types of evidence can be uploaded?',
    a: 'CourtAccess supports documents, photographs, audio recordings, and video evidence. Each file type is handled with appropriate integrity verification and metadata extraction.',
  },
  {
    q: 'Can I upload video or audio evidence?',
    a: 'Yes. We support common audio formats (MP3, WAV, M4A, AAC, OGG, FLAC) and video formats (MP4, MOV, AVI, MKV, WEBM). Files up to 500MB can be uploaded on Professional and Team plans.',
  },
  {
    q: 'Is CourtAccess compliant with legal privacy requirements?',
    a: 'CourtAccess is designed with legal privacy requirements in mind. We enforce strict tenant isolation, immutable audit trails, cryptographic document integrity, and role-based access control. All processing stays within defined constitutional boundaries.',
  },
  {
    q: 'How large can uploaded files be?',
    a: 'Free tier supports files up to 10MB. Professional plans support files up to 500MB. Team plans support files up to 1GB. Contact us for enterprise needs requiring larger file support.',
  },
  {
    q: 'Can I delete my files at any time?',
    a: 'Yes. You retain full control over your uploaded files and can delete them at any time from your dashboard. Deletion is permanent and irreversible, though cryptographic audit records are preserved.',
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left group"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-slate-900 pr-4 group-hover:text-amber-700 transition-colors">
          {question}
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="pb-5 pr-8">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Everything you need to know about CourtAccess.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-6 sm:px-8 divide-y divide-gray-100">
          {faqItems.map((item) => (
            <FAQItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Contact Form Section ----

function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    subject: '',
    message: '',
    _honeypot: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const lastSubmitRef = useRef(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (formData._honeypot) return;

    // Rate limiting — 30 seconds between submissions
    const now = Date.now();
    if (now - lastSubmitRef.current < 30000) {
      setStatus('error');
      return;
    }
    lastSubmitRef.current = now;

    setStatus('sending');
    trackEvent('contact_form_submit', { role: formData.role });

    try {
      // Send via mailto fallback for now — will be wired to API endpoint when backend is ready
      const mailtoLink = `mailto:support@courtaccess.net?subject=${encodeURIComponent(`[Contact Form] ${formData.subject}`)}&body=${encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\nRole: ${formData.role}\n\n${formData.message}`)}`;
      window.open(mailtoLink, '_blank');
      setStatus('sent');
      setFormData({ name: '', email: '', role: '', subject: '', message: '', _honeypot: '' });
    } catch {
      setStatus('error');
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-xl mb-4">
            <MessageSquare className="text-slate-600" size={22} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Get in touch
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Have questions about CourtAccess? We&rsquo;d love to hear from you.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <CheckCircle className="text-green-600 mx-auto mb-3" size={32} />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Message sent</h3>
            <p className="text-sm text-gray-600">Thank you for reaching out. We&rsquo;ll get back to you within 24 hours.</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-4 text-sm text-amber-700 hover:text-amber-800 font-medium"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-gray-100">
            {/* Honeypot — hidden from users */}
            <input
              type="text"
              name="_honeypot"
              value={formData._honeypot}
              onChange={(e) => updateField('_honeypot', e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-medium text-slate-700 mb-1.5">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="contact-role" className="block text-xs font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  id="contact-role"
                  required
                  value={formData.role}
                  onChange={(e) => updateField('role', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                >
                  <option value="" disabled>Select your role</option>
                  <option value="Attorney">Attorney</option>
                  <option value="Investigator">Investigator</option>
                  <option value="Legal Assistant">Legal Assistant</option>
                  <option value="Researcher">Researcher</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-700 mb-1.5">Subject</label>
                <input
                  id="contact-subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="How can we help?"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="contact-message" className="block text-xs font-medium text-slate-700 mb-1.5">Message</label>
              <textarea
                id="contact-message"
                required
                rows={4}
                value={formData.message}
                onChange={(e) => updateField('message', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                placeholder="Tell us about your needs..."
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
              <Send size={14} />
            </button>

            {status === 'error' && (
              <p className="mt-3 text-sm text-red-600">Something went wrong. Please try again in a moment.</p>
            )}
          </form>
        )}
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

    // FAQ schema markup for SEO
    const faqSchema = document.createElement('script');
    faqSchema.type = 'application/ld+json';
    faqSchema.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    });
    document.head.appendChild(faqSchema);

    return () => {
      document.head.removeChild(schema);
      document.head.removeChild(faqSchema);
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
      <FAQSection />
      <ContactSection />
      <CTASection />
      <Footer />
    </div>
  );
}
