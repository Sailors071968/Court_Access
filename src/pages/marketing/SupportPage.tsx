// ============================================================================
// Support Page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import { Mail, MessageSquare, BookOpen, HelpCircle, Clock } from 'lucide-react';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const SUPPORT_CHANNELS = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Reach our support team for account, billing, and technical questions.',
    action: 'support@courtaccess.net',
    href: 'mailto:support@courtaccess.net',
  },
  {
    icon: MessageSquare,
    title: 'In-Platform Messaging',
    description: 'Subscribers can message support directly from the account settings dashboard.',
    action: 'Login to contact',
    href: '/login',
    isRoute: true,
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description: 'Self-service guides for getting started, case management, and billing.',
    action: 'Browse articles',
    href: '/knowledge-base',
    isRoute: true,
  },
  {
    icon: HelpCircle,
    title: 'FAQ',
    description: 'Answers to the most common questions about CourtAccess.',
    action: 'View FAQ',
    href: '/faq',
    isRoute: true,
  },
];

export function SupportPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Support
          </h1>
          <p className="text-lg text-slate-300">
            We are here to help you get the most from CourtAccess.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            {SUPPORT_CHANNELS.map(({ icon: Icon, title, description, action, href, isRoute }) => (
              <div key={title} className="p-6 rounded-xl border border-slate-200 bg-white/5">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="text-amber-600" size={20} />
                </div>
                <h2 className="font-bold text-slate-900 mb-2">{title}</h2>
                <p className="text-sm text-slate-600 mb-4">{description}</p>
                {isRoute ? (
                  <Link to={href} className="text-amber-600 hover:text-amber-500 text-sm font-semibold">
                    {action} →
                  </Link>
                ) : (
                  <a href={href} className="text-amber-600 hover:text-amber-500 text-sm font-semibold">
                    {action} →
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-4">
            <Clock className="text-slate-400 shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Response Times</h3>
              <p className="text-sm text-slate-600">
                Email support typically responds within one business day. Enterprise customers
                receive priority support. For urgent security matters, contact{' '}
                <a href="mailto:security@courtaccess.net" className="text-amber-600 hover:underline">
                  security@courtaccess.net
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
