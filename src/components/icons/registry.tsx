// =============================================================================
// CourtAccess — Master Iconography System (Program 19)
// One icon library (lucide-react). One mapping. One visual language.
// Every domain concept resolves to a single canonical icon + variant styling.
// =============================================================================

import {
  Fingerprint,
  Users,
  Clock,
  Scale,
  Gavel,
  Landmark,
  FileText,
  Network,
  Briefcase,
  Search,
  User,
  Building2,
  Files,
  UploadCloud,
  ScanLine,
  Sparkles,
  Bell,
  MessageSquare,
  Settings,
  ClipboardList,
  UserCheck,
  ShieldCheck,
  Gauge,
  BadgeCheck,
  HelpCircle,
  GitCompare,
  SearchX,
  FolderSearch,
  ListChecks,
  Calendar,
  SlidersHorizontal,
  Lock,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';

/** Canonical domain concepts across the platform */
export type IconName =
  | 'evidence'
  | 'witness'
  | 'timeline'
  | 'statutes'
  | 'caseLaw'
  | 'authorities'
  | 'reports'
  | 'knowledgeGraph'
  | 'attorney'
  | 'investigator'
  | 'defendant'
  | 'lawFirm'
  | 'judge'
  | 'court'
  | 'documents'
  | 'upload'
  | 'ocr'
  | 'aiAnalysis'
  | 'notifications'
  | 'messages'
  | 'settings'
  | 'audit'
  | 'humanReview'
  | 'repositoryIntegrity'
  | 'caseStrength'
  | 'evidenceConfidence'
  | 'unknown'
  | 'contradiction'
  | 'evidenceGap'
  | 'discovery'
  | 'tasks'
  | 'calendar'
  | 'search'
  | 'filters'
  | 'security'
  | 'permissions';

/** Single source of truth: domain concept → lucide icon */
export const ICON_REGISTRY: Record<IconName, LucideIcon> = {
  evidence: Fingerprint,
  witness: Users,
  timeline: Clock,
  statutes: Scale,
  caseLaw: BadgeCheck,
  authorities: Landmark,
  reports: FileText,
  knowledgeGraph: Network,
  attorney: Briefcase,
  investigator: Search,
  defendant: User,
  lawFirm: Building2,
  judge: Gavel,
  court: Landmark,
  documents: Files,
  upload: UploadCloud,
  ocr: ScanLine,
  aiAnalysis: Sparkles,
  notifications: Bell,
  messages: MessageSquare,
  settings: Settings,
  audit: ClipboardList,
  humanReview: UserCheck,
  repositoryIntegrity: ShieldCheck,
  caseStrength: Gauge,
  evidenceConfidence: BadgeCheck,
  unknown: HelpCircle,
  contradiction: GitCompare,
  evidenceGap: SearchX,
  discovery: FolderSearch,
  tasks: ListChecks,
  calendar: Calendar,
  search: Search,
  filters: SlidersHorizontal,
  security: Lock,
  permissions: KeyRound,
};

/** Interaction / semantic variants for a given icon */
export type IconVariant =
  | 'default'
  | 'hover'
  | 'selected'
  | 'disabled'
  | 'alert'
  | 'success'
  | 'warning'
  | 'highConfidence'
  | 'lowConfidence';

/** Variant → Tailwind color class (dark-mode first) */
export const ICON_VARIANT_CLASS: Record<IconVariant, string> = {
  default: 'text-slate-400',
  hover: 'text-white',
  selected: 'text-gold-light',
  disabled: 'text-slate-600 opacity-50',
  alert: 'text-red-400',
  success: 'text-emerald-400',
  warning: 'text-gold-light',
  highConfidence: 'text-emerald-400',
  lowConfidence: 'text-orange-400',
};

export interface IconProps {
  name: IconName;
  variant?: IconVariant;
  size?: number;
  className?: string;
  'aria-label'?: string;
  strokeWidth?: number;
}

/**
 * Canonical Icon component. Always prefer <Icon name="evidence" /> over importing
 * lucide icons directly so the platform stays visually consistent.
 */
export function Icon({
  name,
  variant = 'default',
  size = 18,
  className,
  strokeWidth = 2,
  'aria-label': ariaLabel,
}: IconProps) {
  const LucideComp = ICON_REGISTRY[name];
  const variantClass = ICON_VARIANT_CLASS[variant];
  return (
    <LucideComp
      size={size}
      strokeWidth={strokeWidth}
      className={[variantClass, className].filter(Boolean).join(' ')}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    />
  );
}

/** Human-readable labels for each concept (for tooltips, a11y, docs) */
export const ICON_LABELS: Record<IconName, string> = {
  evidence: 'Evidence',
  witness: 'Witness',
  timeline: 'Timeline',
  statutes: 'Statutes',
  caseLaw: 'Case Law',
  authorities: 'Authorities',
  reports: 'Reports',
  knowledgeGraph: 'Knowledge Graph',
  attorney: 'Attorney',
  investigator: 'Investigator',
  defendant: 'Defendant',
  lawFirm: 'Law Firm',
  judge: 'Judge',
  court: 'Court',
  documents: 'Documents',
  upload: 'Upload',
  ocr: 'OCR',
  aiAnalysis: 'AI Analysis',
  notifications: 'Notifications',
  messages: 'Messages',
  settings: 'Settings',
  audit: 'Audit',
  humanReview: 'Human Review',
  repositoryIntegrity: 'Repository Integrity',
  caseStrength: 'Case Strength',
  evidenceConfidence: 'Evidence Confidence',
  unknown: 'Unknown',
  contradiction: 'Contradiction',
  evidenceGap: 'Evidence Gap',
  discovery: 'Discovery',
  tasks: 'Tasks',
  calendar: 'Calendar',
  search: 'Search',
  filters: 'Filters',
  security: 'Security',
  permissions: 'Permissions',
};
