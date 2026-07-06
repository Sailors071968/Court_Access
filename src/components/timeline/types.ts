// =============================================================================
// CourtAccess — Unified Timeline Engine types (Program 26)
// One event model powers every timeline across the platform.
// =============================================================================

export type TimelineSignificance = 'routine' | 'notable' | 'significant' | 'critical';

export interface TimelineEvent {
  id: string;
  /** ISO timestamp, or null when the time is UNKNOWN (never fabricate). */
  timestamp: string | null;
  title: string;
  description?: string;
  actor?: string;
  /** Free-form category used for grouping & filtering (e.g. "camera", "policy"). */
  category?: string;
  significance?: TimelineSignificance;
  /** 0–100. */
  confidence?: number;
  evidenceIds?: string[];
  authorities?: string[];
  citations?: string[];
  isContradiction?: boolean;
  isUnknown?: boolean;
  source?: string;
}

export type TimelineVariant =
  | 'case'
  | 'investigation'
  | 'evidence'
  | 'discovery'
  | 'court'
  | 'witness'
  | 'ocr'
  | 'knowledge'
  | 'audit'
  | 'system';

export type TimelineGrouping = 'none' | 'day' | 'type' | 'actor' | 'significance';

export type TimelineZoom = 'compact' | 'comfortable' | 'spacious';

export interface TimelineOverlayFlags {
  evidence: boolean;
  authorities: boolean;
  contradictions: boolean;
  unknowns: boolean;
}
