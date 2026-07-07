// ============================================================================
// Accessibility Page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import { Accessibility, Eye, Keyboard, Monitor, ArrowRight } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const COMMITMENTS = [
  {
    icon: Eye,
    title: 'Visual Accessibility',
    description: 'High-contrast color schemes, readable typography, and scalable text throughout the public website and application.',
  },
  {
    icon: Keyboard,
    title: 'Keyboard Navigation',
    description: 'Core workflows support keyboard navigation. Focus indicators are visible on interactive elements.',
  },
  {
    icon: Monitor,
    title: 'Responsive Design',
    description: 'The platform adapts to desktop, tablet, and mobile viewports for access from any device.',
  },
  {
    icon: Accessibility,
    title: 'WCAG Alignment',
    description: 'CourtAccess is committed to aligning with WCAG 2.1 Level AA guidelines. Continuous improvement is ongoing.',
  },
];

export function AccessibilityPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Accessibility
          </h1>
          <p className="text-lg text-slate-300">
            CourtAccess is committed to making criminal case intelligence accessible to everyone.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-slate-300 leading-relaxed mb-10 text-center max-w-2xl mx-auto">
            We believe attorneys, defendants, investigators, and family members should be able to
            access case information regardless of ability. We continuously improve accessibility
            across our public website and authenticated platform.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            {COMMITMENTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-5 rounded-xl border border-white/10 bg-white/5">
                <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="text-gold-light" size={20} />
                </div>
                <h2 className="font-semibold text-white mb-2">{title}</h2>
                <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <div className="text-center p-6 rounded-xl bg-white/5 border border-white/10">
            <p className="text-slate-300 mb-4">
              Encounter an accessibility barrier? Contact us at{' '}
              <a href="mailto:accessibility@courtaccess.net" className="text-amber-600 hover:underline">
                accessibility@courtaccess.net
              </a>
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-500 font-semibold text-sm"
            >
              Contact Us
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
