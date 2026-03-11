// ============================================================================
// Phase 281 — Litigation Recommendation Database Schema
// Canonical type for all recommendation types.
// Table: LitigationRecommendation
// ============================================================================

export type RecommendationType = 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';

export interface LitigationRecommendation {
  id: string;
  caseId: string;
  recommendationType: RecommendationType;
  category: string;
  evidenceSource: string;
  observation: string;
  suggestedOpportunity: string;
  confidenceScore: number;
  timestamp: string;
  /** Attorney feedback status */
  feedbackStatus?: 'relevant' | 'already_handled' | 'not_relevant' | null;
  /** Evidence links for Phase 283 */
  evidenceLinks?: EvidenceLink[];
  /** Deduplication hash for Phase 284 */
  deduplicationKey?: string;
}

export interface EvidenceLink {
  evidenceFileId: string;
  evidenceFileName: string;
  timestamp?: string;
  documentParagraph?: string;
  pageNumber?: number;
}

/**
 * Phase 289 — Case Readiness Score
 */
export interface CaseReadinessScore {
  caseId: string;
  overallScore: number;
  evidenceCompleteness: number;
  investigativeOpportunitiesAddressed: number;
  recordsObtained: number;
  expertConsultation: number;
  totalRecommendations: number;
  addressedRecommendations: number;
  timestamp: string;
}

/**
 * Phase 290 — Litigation Roadmap Step
 */
export interface LitigationRoadmapStep {
  stepNumber: number;
  description: string;
  category: RecommendationType;
  status: 'pending' | 'in_progress' | 'completed';
  linkedRecommendationIds: string[];
}

// ============================================================================
// Legal Disclaimer — MUST appear on all outputs
// ============================================================================

export const LITIGATION_INTELLIGENCE_DISCLAIMER =
  'CourtAccess provides analytical observations based on uploaded evidence. ' +
  'Attorneys must independently evaluate all legal strategies.';
