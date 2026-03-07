// ============================================
// Court Access — Evidence Summary Model (AI Evidence Intelligence Phase 8)
// AI-generated summaries for each evidence item.
//
// Summary types:
//   - Document summary
//   - Audio conversation summary
//   - Video content summary
//   - Image description summary
//
// Deterministic storage — no probabilistic scoring.
// ============================================

// ---------------------------------------------------------------------------
// Evidence Summary
// ---------------------------------------------------------------------------

/**
 * AI-generated summary for an evidence record.
 */
export interface EvidenceSummary {
  summaryId: string;
  evidenceId: string;
  caseId: string;
  tenantId: string;
  summaryText: string;                  // AI-generated summary
  summaryType: SummaryType;
  keyPoints: string[];                  // Extracted key points
  mentionedEntities: MentionedEntity[]; // People, places, dates mentioned
  wordCount: number;
  generatedTimestamp: string;           // ISO 8601
  modelVersion: string;                 // AI model version used
}

// ---------------------------------------------------------------------------
// Summary Types
// ---------------------------------------------------------------------------

export type SummaryType = 'document' | 'audio_conversation' | 'video_content' | 'image_description';

export const SUMMARY_TYPE_LABELS: Record<SummaryType, string> = {
  document: 'Document Summary',
  audio_conversation: 'Audio Conversation Summary',
  video_content: 'Video Content Summary',
  image_description: 'Image Description',
} as const;

// ---------------------------------------------------------------------------
// Mentioned Entity
// ---------------------------------------------------------------------------

export interface MentionedEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'legal_term';
  occurrenceCount: number;
}

// ---------------------------------------------------------------------------
// Summary Generation Input/Result
// ---------------------------------------------------------------------------

export interface SummaryGenerationInput {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  textContent: string;
  summaryType: SummaryType;
}

export interface SummaryGenerationResult {
  success: boolean;
  summary: EvidenceSummary | null;
  error: string | null;
}
