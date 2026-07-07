// ============================================================================
// Press Page — Program 1 v18.0
// ============================================================================

import { Link } from 'react-router-dom';
import { Newspaper, Mail, ArrowRight } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const PRESS_ITEMS = [
  {
    date: '2026-06-01',
    title: 'CourtAccess Launches Criminal Case Intelligence Platform',
    excerpt: 'Evidence-governed litigation platform for California criminal defense enters public beta.',
  },
  {
    date: '2026-05-15',
    title: 'Universal Membership Model: Full Platform Access for Every Subscriber',
    excerpt: 'CourtAccess eliminates artificial feature tiers — permissions, not subscriptions, control visibility.',
  },
  {
    date: '2026-04-20',
    title: 'California Legislative Intelligence Pipeline Operational',
    excerpt: 'Automated discovery of offenses, elements, penalties, and CALCRIM relationships across California Codes.',
  },
];

export function PressPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <Newspaper className="text-amber-400" size={16} />
            <span className="text-amber-300 text-sm font-medium">Press</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Press & Media
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            News and announcements from CourtAccess — the criminal litigation operating system.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {PRESS_ITEMS.map((item) => (
            <article key={item.title} className="p-6 rounded-xl border border-slate-200 bg-white/5">
              <time className="text-sm text-slate-500">{item.date}</time>
              <h2 className="text-xl font-bold text-slate-900 mt-2 mb-2">{item.title}</h2>
              <p className="text-slate-600 leading-relaxed">{item.excerpt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Media Inquiries</h2>
          <p className="text-slate-600 mb-6">
            For press kits, interviews, and product demonstrations, contact our media team.
          </p>
          <a
            href="mailto:press@courtaccess.net"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-500 font-semibold"
          >
            <Mail size={18} />
            press@courtaccess.net
          </a>
          <div className="mt-8">
            <Link to="/about" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
              About CourtAccess
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
