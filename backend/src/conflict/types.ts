// ============================================
// Court Access — Narrative Conflict Detection Types
// Phase 3: Conflict detection between officer statements,
// witness testimony, evidence metadata, timeline events,
// policies, and statutes.
// ============================================

import type {
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphRelationship,
} from '../graph/types.ts';

// ---------------------------------------------------------------------------
// Conflict Types
// ---------------------------------------------------------------------------

export type ConflictType =
  | 'timeline'
  | 'testimony'
  | 'evidence'
  | 'policy_violation'
  | 'legal_claim';

// ---------------------------------------------------------------------------
// Conflict Severity
// ---------------------------------------------------------------------------

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Conflict Relationship Types (subset of GraphRelationshipType)
// ---------------------------------------------------------------------------

export type ConflictRelationshipType =
  | 'CONTRADICTS'
  | 'INVALIDATES'
  | 'WEAKENS'
  | 'SUPPORTS';

// ---------------------------------------------------------------------------
// Severity Scoring Factors
// ---------------------------------------------------------------------------

export interface ConflictScoringFactors {
  /** Strength of the temporal contradiction (0.0–1.0) */
  temporalContradictionStrength: number;
  /** Reliability of the underlying evidence (0.0–1.0) */
  evidenceReliability: number;
  /** Weight of policy violation implications (0.0–1.0) */
  policyViolationWeight: number;
  /** Number of independent sources supporting the conflict */
  supportingSourceCount: number;
}

// ---------------------------------------------------------------------------
// Conflict Severity Scoring Weights
// ---------------------------------------------------------------------------

export interface ConflictScoringWeights {
  temporalContradictionStrength: number;
  evidenceReliability: number;
  policyViolationWeight: number;
  supportingSourceCount: number;
}

export const DEFAULT_CONFLICT_SCORING_WEIGHTS: Readonly<ConflictScoringWeights> = {
  temporalContradictionStrength: 0.35,
  evidenceReliability: 0.25,
  policyViolationWeight: 0.25,
  supportingSourceCount: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Conflict Severity Score
// ---------------------------------------------------------------------------

export interface ConflictSeverityScore {
  /** Composite severity score (0.0–1.0) */
  severityScore: number;
  /** Severity level derived from score */
  severity: ConflictSeverity;
  /** Individual scoring factors */
  factors: ConflictScoringFactors;
  /** Weights used */
  weights: ConflictScoringWeights;
}

// ---------------------------------------------------------------------------
// Statement — normalized representation of a testimony/statement
// ---------------------------------------------------------------------------

export interface Statement {
  /** Unique statement identifier */
  id: string;
  /** Who made this statement */
  speakerId: string;
  /** Speaker name */
  speakerName: string;
  /** Speaker role: officer | witness | defendant | expert */
  speakerRole: 'officer' | 'witness' | 'defendant' | 'expert';
  /** The statement content */
  content: string;
  /** Source document ID */
  sourceDocumentId: string;
  /** Tenant isolation */
  tenantId: string;
  /** When the statement was made (if known) */
  statementDate: Date | null;
  /** Character offset in source document */
  startOffset: number;
  endOffset: number;
}

// ---------------------------------------------------------------------------
// Timeline Event — normalized temporal event
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  /** Unique event identifier */
  id: string;
  /** Event description */
  description: string;
  /** Normalized timestamp */
  timestamp: Date;
  /** Precision of the timestamp */
  precision: 'exact' | 'approximate' | 'date_only' | 'range';
  /** End of range (if precision is 'range') */
  endTimestamp: Date | null;
  /** Source statement or evidence that reported this event */
  sourceId: string;
  /** Source type */
  sourceType: 'statement' | 'evidence' | 'document';
  /** Speaker who reported it */
  speakerId: string;
  /** Source document */
  sourceDocumentId: string;
  /** Tenant isolation */
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Detected Conflict — output of conflict detection
// ---------------------------------------------------------------------------

export interface DetectedConflict {
  /** Unique conflict identifier */
  id: string;
  /** Type of conflict */
  conflictType: ConflictType;
  /** Human-readable description */
  description: string;
  /** Severity scoring */
  severity: ConflictSeverityScore;
  /** Source nodes involved in the conflict */
  sourceNodeIds: string[];
  /** Target nodes involved in the conflict */
  targetNodeIds: string[];
  /** Related evidence IDs */
  evidenceIds: string[];
  /** Tenant isolation */
  tenantId: string;
  /** Source document IDs */
  sourceDocumentIds: string[];
  /** Detected at */
  detectedAt: Date;
}

// ---------------------------------------------------------------------------
// Statement Comparison Result
// ---------------------------------------------------------------------------

export interface StatementComparisonResult {
  /** Statement A */
  statementA: Statement;
  /** Statement B */
  statementB: Statement;
  /** Similarity score (0.0–1.0; lower means more contradictory) */
  similarity: number;
  /** Whether this constitutes a contradiction */
  isContradiction: boolean;
  /** Specific contradictory fragments */
  contradictions: Array<{
    fragmentA: string;
    fragmentB: string;
    category: 'factual' | 'temporal' | 'spatial' | 'quantitative';
  }>;
}

// ---------------------------------------------------------------------------
// Timeline Conflict
// ---------------------------------------------------------------------------

export interface TimelineConflict {
  /** Event A (claimed first/earlier) */
  eventA: TimelineEvent;
  /** Event B (contradicts A's timing) */
  eventB: TimelineEvent;
  /** Overlap or impossibility description */
  conflictDescription: string;
  /** Time gap in milliseconds (negative means overlap) */
  timeGapMs: number;
  /** Whether the conflict involves the same speaker */
  sameSpeaker: boolean;
}

// ---------------------------------------------------------------------------
// Conflict Detection Request
// ---------------------------------------------------------------------------

export interface ConflictDetectionRequest {
  /** Tenant isolation (acts as case ID) */
  tenantId: string;
  /** Statements to analyze */
  statements: Statement[];
  /** Timeline events to analyze */
  timelineEvents: TimelineEvent[];
  /** Related graph nodes */
  graphNodes: GraphNode[];
  /** Existing graph relationships */
  graphRelationships: GraphRelationship[];
}

// ---------------------------------------------------------------------------
// Conflict Detection Result
// ---------------------------------------------------------------------------

export interface ConflictDetectionResult {
  /** All detected conflicts */
  conflicts: DetectedConflict[];
  /** Timeline conflicts specifically */
  timelineConflicts: TimelineConflict[];
  /** Statement contradictions */
  statementContradictions: StatementComparisonResult[];
  /** Total statements analyzed */
  totalStatementsAnalyzed: number;
  /** Total timeline events analyzed */
  totalTimelineEventsAnalyzed: number;
  /** Processing duration */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Graph Integration Result
// ---------------------------------------------------------------------------

export interface ConflictGraphInsertionResult {
  /** Conflict nodes created */
  conflictNodesCreated: number;
  /** Relationships created */
  relationshipsCreated: number;
  /** Conflicts that were inserted */
  insertedConflictIds: string[];
  /** Duration */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type {
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphRelationship,
};
