// ============================================================================
// Knowledge Base Page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import {
  BookOpen,
  HelpCircle,
  CreditCard,
  Shield,
  Users,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const CATEGORIES = [
  {
    icon: BookOpen,
    title: 'Getting Started',
    articles: [
      { title: 'Creating your account', href: '/register' },
      { title: 'Starting your free trial', href: '/pricing' },
      { title: 'How CourtAccess works', href: '/how-it-works' },
      { title: 'Inviting team members', href: '/faq' },
    ],
  },
  {
    icon: FileText,
    title: 'Case Management',
    articles: [
      { title: 'Uploading evidence', href: '/faq' },
      { title: 'Document redaction', href: '/security' },
      { title: 'Publication profiles', href: '/security' },
      { title: 'Generating reports', href: '/features' },
    ],
  },
  {
    icon: Users,
    title: 'Roles & Permissions',
    articles: [
      { title: 'Attorney workspace', href: '/attorney' },
      { title: 'Investigator workspace', href: '/investigator' },
      { title: 'Client portal', href: '/defendant' },
      { title: 'Family member access', href: '/families' },
    ],
  },
  {
    icon: CreditCard,
    title: 'Billing & Subscription',
    articles: [
      { title: 'Pricing plans', href: '/pricing' },
      { title: 'Credit purchases', href: '/pricing' },
      { title: 'Billing portal', href: '/faq' },
      { title: 'Cancel or change plan', href: '/faq' },
    ],
  },
  {
    icon: Shield,
    title: 'Security & Privacy',
    articles: [
      { title: 'Security overview', href: '/security' },
      { title: 'Privacy policy', href: '/privacy' },
      { title: 'Data encryption', href: '/security' },
      { title: 'MFA setup', href: '/faq' },
    ],
  },
  {
    icon: HelpCircle,
    title: 'Support',
    articles: [
      { title: 'Contact support', href: '/support' },
      { title: 'FAQ', href: '/faq' },
      { title: 'Accessibility', href: '/accessibility' },
      { title: 'Legal disclaimer', href: '/legal-disclaimer' },
    ],
  },
];

export function KnowledgeBasePage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Knowledge Base
          </h1>
          <p className="text-lg text-slate-300">
            Guides and documentation for using CourtAccess.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {CATEGORIES.map(({ icon: Icon, title, articles }) => (
              <div key={title}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center">
                    <Icon className="text-amber-600" size={18} />
                  </div>
                  <h2 className="font-bold text-white">{title}</h2>
                </div>
                <ul className="space-y-2">
                  {articles.map((article) => (
                    <li key={article.title}>
                      <Link
                        to={article.href}
                        className="text-sm text-slate-300 hover:text-amber-600 transition-colors flex items-center gap-1"
                      >
                        <ArrowRight size={12} className="shrink-0" />
                        {article.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
