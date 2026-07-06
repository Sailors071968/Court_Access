// =============================================================================
// CourtAccess — Unified Design System Tokens
// Single source of truth for colors, typography, spacing, and surfaces.
// =============================================================================

/** Brand palette — Deep Navy / Gold / Glass */
export const BRAND = {
  navy: '#0f172a',
  navyLight: '#1e293b',
  navyMedium: '#334155',
  gold: '#C8963E',
  goldLight: '#f59e0b',
  goldDark: '#b45309',
  white: '#ffffff',
  slate: '#64748b',
} as const;

/** Tailwind class mappings for status semantics */
export const STATUS_COLORS = {
  danger: 'text-red-600 bg-red-50 border-red-100',
  warning: 'text-amber-600 bg-amber-50 border-amber-100',
  info: 'text-blue-600 bg-blue-50 border-blue-100',
  neutral: 'text-slate-600 bg-slate-50 border-slate-100',
  success: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  accent: 'text-violet-600 bg-violet-50 border-violet-100',
  orange: 'text-orange-600 bg-orange-50 border-orange-100',
} as const;

export const TEXT_COLORS = {
  danger: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
  neutral: 'text-slate-600',
  success: 'text-emerald-600',
  accent: 'text-violet-600',
  orange: 'text-orange-600',
  gold: 'text-gold',
  navy: 'text-navy',
} as const;

/** Reusable surface classes */
export const SURFACES = {
  page: 'bg-surface-muted min-h-screen',
  card: 'bg-white rounded-2xl border border-slate-200/80 shadow-sm',
  cardElevated: 'bg-white rounded-2xl border border-slate-200/60 shadow-md shadow-navy/5',
  glass: 'bg-navy/95 backdrop-blur-md border border-white/10',
  glassLight: 'bg-white/80 backdrop-blur-md border border-white/60',
  glassDark: 'bg-navy-light/90 backdrop-blur-lg border border-white/5',
  hero: 'bg-navy text-white',
  sidebar: 'bg-navy-light text-white border-r border-white/5',
} as const;

/** Typography scale */
export const TYPOGRAPHY = {
  display: 'text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]',
  h1: 'text-3xl sm:text-4xl font-bold tracking-tight text-navy',
  h2: 'text-2xl sm:text-3xl font-bold tracking-tight text-navy',
  h3: 'text-xl font-semibold text-navy',
  h4: 'text-lg font-semibold text-navy',
  body: 'text-base text-slate-600 leading-relaxed',
  bodyLg: 'text-lg text-slate-300 leading-relaxed',
  caption: 'text-sm text-slate-500',
  overline: 'text-xs font-semibold uppercase tracking-wider text-gold',
} as const;

/** Spacing rhythm */
export const SPACING = {
  section: 'py-20 lg:py-28',
  sectionSm: 'py-12 lg:py-16',
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  stack: 'space-y-6',
  stackLg: 'space-y-10',
} as const;

/** Animation utilities (subtle motion only) */
export const MOTION = {
  transition: 'transition-all duration-200 ease-out',
  hoverLift: 'hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200',
  fadeIn: 'animate-in fade-in duration-300',
} as const;

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
