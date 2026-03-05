// ============================================
// Court Access — Case Timeline Model (AI Evidence Intelligence Phase 6)
// Visual timeline of events extracted from evidence.
//
// Sources:
//   - Audio timestamps
//   - Video timestamps
//   - Document dates
//   - Message metadata
//
// Deterministic — no probabilistic scoring.
// ============================================

// ---------------------------------------------------------------------------
// Timeline Event Source Types
// ---------------------------------------------------------------------------

export type TimelineEventSource =
  | 'audio_transcript'
  | 'video_transcript'
  | 'video_frame'
  | 'document_date'
  | 'document_content'
  | 'image_exif'
  | 'manual';

// ---------------------------------------------------------------------------
// Timeline Event
// ---------------------------------------------------------------------------

/**
 * A single event on the case timeline.
 * Extracted from evidence or manually added.
 */
export interface CaseTimelineEvent {
  eventId: string;
  caseId: string;
  tenantId: string;
  timestamp: string;                    // ISO 8601 — when the event occurred
  sourceEvidenceId: string | null;      // Evidence record that produced this event
  sourceType: TimelineEventSource;
  eventDescription: string;
  eventCategory: TimelineEventCategory;
  metadata: Record<string, string>;     // Additional context (e.g. speaker, page number)
  createdAt: string;                    // ISO 8601 — when this timeline entry was created
}

// ---------------------------------------------------------------------------
// Timeline Event Categories
// ---------------------------------------------------------------------------

export type TimelineEventCategory =
  | 'communication'
  | 'meeting'
  | 'filing'
  | 'incident'
  | 'testimony'
  | 'evidence_collected'
  | 'court_action'
  | 'other';

export const TIMELINE_CATEGORY_LABELS: Record<TimelineEventCategory, string> = {
  communication: 'Communication',
  meeting: 'Meeting',
  filing: 'Filing',
  incident: 'Incident',
  testimony: 'Testimony',
  evidence_collected: 'Evidence Collected',
  court_action: 'Court Action',
  other: 'Other',
} as const;

// ---------------------------------------------------------------------------
// Timeline Builder Input/Result
// ---------------------------------------------------------------------------

export interface TimelineBuilderInput {
  caseId: string;
  tenantId: string;
  evidenceId: string;
  sourceType: TimelineEventSource;
  extractedEvents: TimelineEventExtraction[];
}

export interface TimelineEventExtraction {
  timestamp: string;
  description: string;
  category: TimelineEventCategory;
  metadata?: Record<string, string>;
}

export interface TimelineBuilderResult {
  success: boolean;
  eventsCreated: number;
  events: CaseTimelineEvent[];
  error: string | null;
}
