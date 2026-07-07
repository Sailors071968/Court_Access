// ============================================================================
// Blog Page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const POSTS = [
  {
    slug: 'evidence-governed-litigation',
    title: 'What Evidence-Governed Litigation Means for Criminal Defense',
    excerpt:
      'Why immutable originals, audit trails, and publication profiles are essential when case outcomes depend on evidence integrity.',
    date: '2026-06-15',
    category: 'Platform',
  },
  {
    slug: 'calcrim-mapping',
    title: 'Connecting Charges to CALCRIM: A Practical Guide',
    excerpt:
      'How CourtAccess maps California Penal Code offenses to jury instructions, elements, and mens rea requirements.',
    date: '2026-06-01',
    category: 'Legal Intelligence',
  },
  {
    slug: 'universal-subscription',
    title: 'Why Every Subscriber Gets the Full Platform',
    excerpt:
      'CourtAccess eliminates artificial feature tiers. Every capability is available to every subscriber — only billing differs.',
    date: '2026-05-20',
    category: 'Product',
  },
  {
    slug: 'publication-profiles',
    title: 'Publication Profiles: Sharing Evidence Without Leaking Privilege',
    excerpt:
      'How redaction and publication controls ensure clients, investigators, and experts see only what they should — and never know what they should not.',
    date: '2026-05-05',
    category: 'Security',
  },
];

export function BlogPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            CourtAccess Blog
          </h1>
          <p className="text-lg text-slate-300">
            Insights on criminal litigation, evidence intelligence, and California law.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {POSTS.map((post) => (
            <article key={post.slug} className="p-6 rounded-xl border border-slate-200 bg-white/5 hover:border-amber-200 transition-colors">
              <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">
                  {post.category}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{post.title}</h2>
              <p className="text-slate-600 leading-relaxed mb-4">{post.excerpt}</p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-500 text-sm font-medium"
              >
                Request full article
                <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
