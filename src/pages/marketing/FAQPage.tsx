// ============================================================================
// FAQ Page — Program 0 Production Website
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const FAQ_ITEMS = [
  {
    q: 'What is CourtAccess?',
    a: 'CourtAccess is a California criminal case intelligence platform that helps attorneys, investigators, and defendants organize case documents, analyze evidence, identify contradictions, and connect legal authorities to charges.',
  },
  {
    q: 'Is CourtAccess a law firm?',
    a: 'No. CourtAccess is a technology platform. It does not provide legal advice and does not create an attorney-client relationship. All legal decisions should be made in consultation with qualified counsel.',
  },
  {
    q: 'Who can use CourtAccess?',
    a: 'Attorneys, criminal defense investigators, defendants, public defenders, paralegals, family members, expert witnesses, and other authorized team members. Every subscriber receives the same platform capabilities — access is controlled by delegated permissions.',
  },
  {
    q: 'How does pricing work?',
    a: 'CourtAccess offers a 30-day free trial, then monthly plans based on case complexity — not profession. There are no feature tiers. See our Pricing page for current plans and video credit packs.',
  },
  {
    q: 'Can I invite other people to my account?',
    a: 'Yes. Every Primary Account Owner can invite up to five additional users with individually configured permissions per case and per resource. Hidden information is completely invisible to unauthorized users.',
  },
  {
    q: 'Is my case data secure?',
    a: 'Yes. CourtAccess uses tenant isolation, encryption, multi-factor authentication, audit logging, and evidence-governed document handling. Original evidence files are never modified.',
  },
  {
    q: 'Does CourtAccess support document redaction?',
    a: 'Yes. You can create redacted publication versions for specific recipients while preserving immutable originals. Redacted content is removed from text layers, OCR, and search indexes.',
  },
  {
    q: 'What jurisdictions does CourtAccess cover?',
    a: 'CourtAccess is built for California criminal litigation, including CALCRIM jury instructions, California Penal Code analysis, and CPRA policy intelligence for law enforcement agencies.',
  },
  {
    q: 'How do I get started?',
    a: 'Create your account, start your free 30-day trial, and upload your first case documents. Our platform guides you through case setup, evidence upload, and intelligence analysis.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email support@courtaccess.net or use our Contact page for enterprise sales inquiries. We respond within 2 business days.',
  },
];

function FAQAccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = q.replace(/\s+/g, '-').toLowerCase().slice(0, 40);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`faq-${id}`}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left bg-white/5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900">{q}</span>
        <ChevronDown
          size={20}
          className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={`faq-${id}`} className="px-6 pb-4 text-slate-600 leading-relaxed border-t border-slate-100 pt-4 bg-slate-50">
          {a}
        </div>
      )}
    </div>
  );
}

export function FAQPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-slate-300">
            Everything you need to know about CourtAccess.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <FAQAccordionItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      <section className="py-12 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-600 mb-4">Still have questions?</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact" className="text-amber-600 hover:text-amber-700 font-medium">
              Contact Us
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Start Free Trial
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
