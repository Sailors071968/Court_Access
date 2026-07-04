// ============================================================================
// Epic 2A — California Legislative Intelligence Platform
// Stage 1: Discovery types
// ============================================================================

export type DiscoveryStatus = 'in_progress' | 'completed' | 'partial' | 'failed';

export type DiscoveryMethod = 'range' | 'link' | 'heading';

export type SectionFlag =
  | 'repealed'
  | 'reserved'
  | 'renumbered'
  | 'missing_candidate'
  | 'ambiguous_range';

export interface StatuteHierarchy {
  code: string;
  division?: string;
  title?: string;
  part?: string;
  chapter?: string;
  article?: string;
  heading?: string;
}

export interface DiscoveredSection {
  code: string;
  section: string;
  canonicalUrl: string;
  hierarchy: StatuteHierarchy;
  discoveryMethod: DiscoveryMethod;
  flags: SectionFlag[];
  sourceUrl: string;
}

export interface HierarchyNode {
  code: string;
  level: 'division' | 'title' | 'part' | 'chapter' | 'article' | 'other';
  label: string;
  sectionRange?: string;
  url: string;
  flags: SectionFlag[];
}

export interface DiscoveryAnomaly {
  type: 'ambiguous_range' | 'unparseable_link' | 'fetch_error' | 'duplicate_section';
  message: string;
  context?: Record<string, string>;
}

export interface DiscoveryAuditEntry {
  timestamp: string;
  action: string;
  detail?: string;
  url?: string;
}

export interface DiscoveryStats {
  pagesFetched: number;
  expandedBranchPages: number;
  displayTextPages: number;
  hierarchyNodes: number;
  sectionsDiscovered: number;
  sectionsFromRanges: number;
  sectionsFromLinks: number;
  anomalies: number;
}

export interface DiscoveryManifest {
  version: string;
  code: string;
  codeName: string;
  discoveredAt: string;
  completedAt?: string;
  status: DiscoveryStatus;
  audit: DiscoveryAuditEntry[];
  hierarchyNodes: HierarchyNode[];
  sections: DiscoveredSection[];
  stats: DiscoveryStats;
  anomalies: DiscoveryAnomaly[];
}

export interface DiscoveryCheckpoint {
  version: string;
  code: string;
  startedAt: string;
  updatedAt: string;
  visitedUrls: string[];
  pendingUrls: string[];
  sections: DiscoveredSection[];
  hierarchyNodes: HierarchyNode[];
  anomalies: DiscoveryAnomaly[];
  stats: DiscoveryStats;
  audit: DiscoveryAuditEntry[];
}

export interface DiscoveryOptions {
  code: string;
  maxPages?: number;
  resumeFrom?: string;
  outputDir?: string;
  userAgent?: string;
}

export type AcquisitionStatus = 'success' | 'failed' | 'skipped';

export interface AcquisitionRecord {
  code: string;
  section: string;
  sourceUrl: string;
  canonicalUrl: string;
  retrievedAt: string;
  html: string;
  httpStatus: number;
  status: AcquisitionStatus;
  errorMessage?: string;
}

export interface AcquisitionCheckpoint {
  version: string;
  code: string;
  manifestPath: string;
  startedAt: string;
  updatedAt: string;
  nextIndex: number;
  acquired: number;
  failed: number;
  skipped: number;
  lastSection?: string;
}

export interface AcquisitionResult {
  code: string;
  status: 'completed' | 'partial' | 'failed';
  acquired: number;
  failed: number;
  skipped: number;
  totalSections: number;
  checkpointPath: string;
  rawHtmlDir: string;
  indexPath: string;
}

export interface AcquisitionOptions {
  code: string;
  manifestPath: string;
  rawHtmlDir?: string;
  maxSections?: number;
  resume?: boolean;
  skipExisting?: boolean;
}

export interface CaliforniaCode {
  abbrev: string;
  name: string;
  criminalPriority: boolean;
}
