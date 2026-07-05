// ============================================================================
// Sitemap Page — Program 1
// ============================================================================

import { Link } from 'react-router-dom';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout';

const SITEMAP_SECTIONS = [
  {
    title: 'Product',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Audiences',
    links: [
      { label: 'Attorneys', href: '/attorney' },
      { label: 'Investigators', href: '/investigator' },
      { label: 'Criminal Defendants', href: '/defendant' },
      { label: 'Families', href: '/families' },
      { label: 'Experts', href: '/experts' },
      { label: 'Government', href: '/government' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Knowledge Base', href: '/knowledge-base' },
      { label: 'Contact', href: '/contact' },
      { label: 'Support', href: '/support' },
      { label: 'Press', href: '/press' },
      { label: 'Careers', href: '/careers' },
      { label: 'Case Studies', href: '/case-studies' },
    ],
  },
  {
    title: 'Legal & Security',
    links: [
      { label: 'Security', href: '/security' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Legal Disclaimer', href: '/legal-disclaimer' },
      { label: 'Accessibility', href: '/accessibility' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Login', href: '/login' },
      { label: 'Register', href: '/register' },
      { label: 'Forgot Password', href: '/forgot-password' },
      { label: 'Verify Email', href: '/verify-email' },
    ],
  },
];

export function SitemapPage() {
  return (
    <PublicMarketingLayout>
      <section className="bg-[#0f172a] py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
            Sitemap
          </h1>
          <p className="text-slate-400">All public pages on courtaccess.net</p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {SITEMAP_SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">
                  {section.title}
                </h2>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="text-sm text-slate-600 hover:text-amber-600 transition-colors"
                      >
                        {link.label}
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
