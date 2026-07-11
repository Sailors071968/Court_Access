// =============================================================================
// CourtAccess — Unified Navigation Configuration (Program 2)
// Single source for public, authenticated, and workspace navigation.
// =============================================================================

export interface NavLink {
  href: string;
  label: string;
  isRoute?: boolean;
  anchor?: boolean;
}

/** Public marketing navigation */
export const PUBLIC_NAV_LINKS: NavLink[] = [
  { href: '/features', label: 'Features', isRoute: true },
  { href: '/how-it-works', label: 'How It Works', isRoute: true },
  { href: '/pricing', label: 'Pricing', isRoute: true },
  { href: '/about', label: 'About', isRoute: true },
  { href: '/faq', label: 'FAQ', isRoute: true },
  { href: '/contact', label: 'Contact', isRoute: true },
];

export const PUBLIC_AUDIENCE_LINKS: NavLink[] = [
  { href: '/attorney', label: 'Attorneys', isRoute: true },
  { href: '/investigator', label: 'Investigators', isRoute: true },
  { href: '/defendant', label: 'Defendants', isRoute: true },
  { href: '/families', label: 'Families', isRoute: true },
  { href: '/experts', label: 'Experts', isRoute: true },
];

export const PUBLIC_FOOTER_SECTIONS = {
  product: [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/faq', label: 'FAQ' },
    { href: '/knowledge-base', label: 'Knowledge Base' },
  ],
  audiences: PUBLIC_AUDIENCE_LINKS,
  company: [
    { href: '/about', label: 'About' },
    { href: '/blog', label: 'Blog' },
    { href: '/press', label: 'Press' },
    { href: '/careers', label: 'Careers' },
    { href: '/support', label: 'Support' },
    { href: '/contact', label: 'Contact' },
    { href: '/login', label: 'Login' },
    { href: '/register', label: 'Free Trial' },
  ],
  legal: [
    { href: '/security', label: 'Security' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/accessibility', label: 'Accessibility' },
    { href: '/legal-disclaimer', label: 'Legal Disclaimer' },
    { href: '/sitemap', label: 'Sitemap' },
  ],
} as const;

export interface WorkspaceNavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  permission?: string | null;
}

/** Authenticated app shell — primary navigation */
export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', permission: null },
  { id: 'cases', label: 'Cases', path: '/cases', icon: 'Briefcase', permission: null },
  { id: 'search', label: 'Search', path: '/search', icon: 'Search', permission: null },
  { id: 'notifications', label: 'Notifications', path: '/notifications', icon: 'Bell', permission: null },
  { id: 'firm', label: 'Law Firm Platform', path: '/firm', icon: 'Settings', permission: 'canViewSettings' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'Settings', permission: 'canViewSettings' },
];

export interface CaseTab {
  id: string;
  label: string;
  path: string;
}

/** Case workspace tabs (Program 7) */
export const CASE_WORKSPACE_TABS: CaseTab[] = [
  { id: 'overview', label: 'Overview', path: '' },
  { id: 'evidence', label: 'Evidence', path: 'evidence' },
  { id: 'documents', label: 'Documents', path: 'documents' },
  { id: 'timeline', label: 'Timeline', path: 'activity' },
  { id: 'charges', label: 'Charges', path: 'charges' },
  { id: 'analysis', label: 'Analysis', path: 'narrative' },
  { id: 'reports', label: 'Reports', path: 'attorney-workbench' },
  { id: 'graph', label: 'Knowledge Graph', path: 'research' },
];

export type WorkspaceType = 'attorney' | 'investigator' | 'defendant' | 'admin';

export const WORKSPACE_LABELS: Record<WorkspaceType, string> = {
  attorney: 'Attorney Workspace',
  investigator: 'Investigator Workspace',
  defendant: 'Client Portal',
  admin: 'Administration',
};
