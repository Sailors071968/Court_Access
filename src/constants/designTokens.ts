// =============================================================================
// CourtAccess — Unified Design System Tokens (Dark-first)
// Single source of truth for colors, typography, spacing, and surfaces.
// The entire platform — public and authenticated — uses one dark navy language.
// =============================================================================

/** Brand palette */
export const BRAND = {
  navy: '#0a0f1c',
  navy800: '#0f172a',
  navy600: '#1e293b',
  gold: '#C8963E',
  goldLight: '#eab360',
  goldBright: '#f5c86e',
  white: '#ffffff',
} as const;

/** Status semantics on dark surfaces */
export const STATUS_COLORS = {
  danger: 'text-red-400 bg-red-500/10 border-red-500/20',
  warning: 'text-gold-light bg-gold/10 border-gold/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  neutral: 'text-slate-300 bg-white/5 border-white/10',
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  accent: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
} as const;

export const TEXT_COLORS = {
  danger: 'text-red-400',
  warning: 'text-gold-light',
  info: 'text-blue-400',
  neutral: 'text-slate-300',
  success: 'text-emerald-400',
  accent: 'text-violet-400',
  orange: 'text-orange-400',
  gold: 'text-gold-light',
  navy: 'text-white',
} as const;

/** Gradient icon-tile variants for stat cards */
export const ICON_TILES = {
  gold: 'ca-icon-gold text-gold-light',
  blue: 'ca-icon-blue text-blue-300',
  violet: 'ca-icon-violet text-violet-300',
  emerald: 'ca-icon-emerald text-emerald-300',
} as const;

export type IconTile = keyof typeof ICON_TILES;

/** Reusable surface classes */
export const SURFACES = {
  page: 'bg-navy-800 min-h-screen text-slate-200',
  panel: 'ca-panel',
  panelHover: 'ca-panel ca-panel-hover',
  glass: 'ca-glass-nav',
  hero: 'ca-gradient-hero text-white',
  sidebar: 'bg-navy-900 text-slate-200 border-r border-white/5',
} as const;

/**
 * Canonical Typography Scale — single source of truth for all text roles.
 * Colors are chosen to meet or exceed WCAG AA contrast on the navy surfaces
 * (#0a0f1c / #0f172a / bg-white/5). Muted roles never go below slate-400
 * (~7:1 on navy) so no text blends into the background.
 *
 * Mirror classes exist in index.css (.ca-display, .ca-page-title, ...) for
 * non-token contexts; keep the two in sync.
 */
export const TYPOGRAPHY = {
  // Display / hero
  display: 'text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-white',
  // Headings
  h1: 'text-3xl sm:text-4xl font-bold tracking-tight text-white',
  h2: 'text-2xl sm:text-3xl font-bold tracking-tight text-white',
  h3: 'text-xl font-semibold text-white',
  h4: 'text-lg font-semibold text-white',
  // Semantic aliases (preferred names going forward)
  pageTitle: 'text-2xl sm:text-3xl font-bold tracking-tight text-white',
  sectionTitle: 'text-lg font-semibold text-white tracking-tight',
  cardTitle: 'text-base font-semibold text-slate-100',
  subtitle: 'text-sm font-medium text-slate-300',
  // Body & supporting text (all AA on navy)
  body: 'text-base text-slate-200 leading-relaxed',
  bodyLg: 'text-lg text-slate-200 leading-relaxed',
  secondary: 'text-sm text-slate-300 leading-relaxed',
  caption: 'text-sm text-slate-400',
  metadata: 'text-xs font-medium uppercase tracking-wide text-slate-400',
  helpText: 'text-xs text-slate-400 leading-relaxed',
  // Tables
  tableHeader: 'text-xs font-semibold uppercase tracking-wide text-slate-300',
  tableCell: 'text-sm text-slate-200',
  // Controls
  label: 'text-sm font-medium text-slate-200',
  button: 'text-sm font-semibold tracking-tight',
  badge: 'text-xs font-semibold',
  nav: 'text-sm font-medium',
  overline: 'text-xs font-semibold uppercase tracking-[0.18em] text-gold-light',
} as const;

/** Spacing rhythm */
export const SPACING = {
  section: 'py-20 lg:py-28',
  sectionSm: 'py-12 lg:py-16',
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  stack: 'space-y-6',
  stackLg: 'space-y-8',
} as const;

/** Animation utilities (subtle motion only) */
export const MOTION = {
  transition: 'transition-all duration-200 ease-out',
  hoverLift: 'hover:-translate-y-0.5 hover:shadow-elevated transition-all duration-200',
  fadeIn: 'animate-fade-in',
} as const;

/** Constitutional trust markers (footer) */
export const TRUST_MARKERS = [
  'Evidence-Governed',
  'Auditable',
  'Transparent',
  'Reproducible',
  'Attorney-First',
  'Built for Justice',
] as const;

export const CONSTITUTION_TAGLINE = 'No Citation → No Evidence → No Finding → UNKNOWN';

/** Intelligence panel types (Program 8) */
export const INTELLIGENCE_PANEL_TYPES = [
  'case_strength',
  'evidence_confidence',
  'repository_integrity',
  'timeline',
  'contradictions',
  'knowledge_graph',
  'authorities',
  'evidence_gaps',
  'unknowns',
  'human_review',
  'investigation_tasks',
] as const;

export type IntelligencePanelType = (typeof INTELLIGENCE_PANEL_TYPES)[number];
export type StatusColor = keyof typeof STATUS_COLORS;
