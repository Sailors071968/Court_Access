// ============================================
// Court Access — Pricing Page
// ============================================

import { Link } from 'react-router-dom';
import { Scale, CheckCircle, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { trackEvent } from '../../utils/analytics';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try Court Access with one free document analysis.',
    features: [
      '1 document analysis',
      'Up to 10 pages per document',
      'Basic structure mapping',
      'Single user account',
      'Email support',
    ],
    cta: 'Get Started Free',
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
      'Cross-case search',
      'Priority email support',
    ],
    cta: 'Start Free Trial',
    ctaStyle: 'bg-slate-800 text-white hover:bg-slate-700 shadow-lg shadow-slate-800/10',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$249',
    period: '/month',
    description: 'For firms and legal organizations.',
    features: [
      'Everything in Professional',
      'Up to 10 team members',
      'Role-based access control',
      'Cross-case indexing',
      'Officer cross-case tracking',
      'Full audit trail & compliance',
      'Dedicated account manager',
      'Phone & video support',
    ],
    cta: 'Contact Sales',
    ctaStyle: 'border border-gray-200 text-slate-800 hover:bg-gray-50',
    highlighted: false,
  },
];

export function PricingPage() {
  useEffect(() => {
    trackEvent('pricing_page_view');
    document.title = 'Pricing — Court Access';
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center">
              <Scale className="text-amber-400" size={18} />
            </div>
            <span className="text-lg font-semibold text-slate-900 tracking-tight">Court Access</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2">Sign in</Link>
            <Link to="/signup" className="text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">
              Start Free Analysis
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Start with a free analysis. Upgrade when you're ready. No hidden fees.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-8 rounded-2xl ${
                plan.highlighted
                  ? 'bg-white border-2 border-slate-800 shadow-xl relative'
                  : 'bg-white border border-gray-100 shadow-sm'
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
                onClick={() => trackEvent('cta_click', { location: 'pricing_page', plan: plan.name })}
                className={`mt-6 block text-center py-3 rounded-xl font-medium text-sm transition-colors ${plan.ctaStyle}`}
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
      </section>

      {/* FAQ */}
      <section className="py-16 bg-slate-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'What counts as a "document analysis"?',
                a: 'Each uploaded document (PDF, DOCX, or transcript) that goes through our structured analysis pipeline counts as one analysis. Multi-page documents count as a single analysis.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. All paid plans are month-to-month with no long-term contracts. Cancel anytime from your account settings.',
              },
              {
                q: 'Is my data secure?',
                a: 'Yes. Every document is encrypted at rest and in transit. We use strict tenant isolation with cryptographic verification. Your data is never shared or used for training.',
              },
              {
                q: 'Do you offer discounts for public defenders?',
                a: 'Yes. Contact us at support@courtaccess.net for public defender and legal aid organization pricing.',
              },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold text-slate-900 text-sm">{faq.q}</h3>
                <p className="mt-2 text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-800 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white">Ready to get started?</h2>
          <p className="mt-3 text-slate-300">Upload your first document free. No credit card required.</p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-xl font-medium hover:bg-amber-400 transition-colors"
          >
            Start Free Analysis <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Court Access. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs text-slate-400 hover:text-white">Privacy</Link>
            <Link to="/terms" className="text-xs text-slate-400 hover:text-white">Terms</Link>
            <Link to="/" className="text-xs text-slate-400 hover:text-white">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
