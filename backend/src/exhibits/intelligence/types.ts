// ============================================
// Court Access — Exhibit Intelligence Engine Types
// Automatic trial exhibit suggestion system that
// analyzes the evidence graph for patterns and
// proposes high-value courtroom visuals.
// ============================================

// ---------------------------------------------------------------------------
// Exhibit Types — categories of visual exhibits
// ---------------------------------------------------------------------------

export type ExhibitType =
  | 'timeline_comparison'
  | 'testimony_vs_transcript'
  | 'officer_movement_map'
  | 'chain_of_custody_flow'
  | 'evidence_relationship_graph'
  | 'narrative_conflict_visualization';

// ---------------------------------------------------------------------------
// Exhibit Idea Status
// ---------------------------------------------------------------------------

export type ExhibitIdeaStatus = 'suggested' | 'saved' | 'dismissed' | 'generated';

// ---------------------------------------------------------------------------
// Trigger Events — what causes the engine to run
// ---------------------------------------------------------------------------

export type ExhibitTriggerEvent =
  | 'EvidenceCreated'
  | 'ConflictNodeCreated'
  | 'TimelineEventAdded'
  | 'TranscriptStatementCreated'
  | 'RelationshipEdgeCreated';

// ---------------------------------------------------------------------------
// Detected Pattern — output of pattern detection
// ---------------------------------------------------------------------------

export interface DetectedPattern {
  /** Unique pattern identifier */
  id: string;
  /** Pattern category */
  patternType: ExhibitType;
  /** Human-readable summary of what was detected */
  summary: string;
  /** Detailed description of the pattern */
  details: string;
  /** Evidence node IDs involved */
  evidenceIds: string[];
  /** Conflict node IDs involved (if any) */
  conflictIds: string[];
  /** Case ID (tenant) */
  caseId: string;
  /** Raw scoring factors for priority computation */
  rawFactors: PatternScoringFactors;
  /** When the pattern was detected */
  detectedAt: Date;
}

// ---------------------------------------------------------------------------
// Pattern Scoring Factors — raw inputs for priority scoring
// ---------------------------------------------------------------------------

export interface PatternScoringFactors {
  /** Severity of conflict(s) involved (0.0-1.0) */
  conflictSeverity: number;
  /** Importance of the underlying evidence (0.0-1.0) */
  evidenceImportance: number;
  /** How clearly a jury would understand this exhibit (0.0-1.0) */
  juryClarityImpact: number;
  /** How novel/unexpected this pattern is (0.0-1.0) */
  noveltyFactor: number;
}

// ---------------------------------------------------------------------------
// Priority Score Weights
// ---------------------------------------------------------------------------

export interface PriorityWeights {
  conflictSeverity: number;
  evidenceImportance: number;
  juryClarityImpact: number;
  noveltyFactor: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: Readonly<PriorityWeights> = {
  conflictSeverity: 0.40,
  evidenceImportance: 0.30,
  juryClarityImpact: 0.20,
  noveltyFactor: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Priority Score Result
// ---------------------------------------------------------------------------

export interface PriorityScoreResult {
  /** Composite priority score (0.0-1.0) */
  score: number;
  /** Individual factor values */
  factors: PatternScoringFactors;
  /** Weights used */
  weights: PriorityWeights;
  /** Human-readable priority band */
  band: PriorityBand;
}

export type PriorityBand = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Exhibit Idea — generated suggestion ready for storage
// ---------------------------------------------------------------------------

export interface ExhibitIdea {
  /** Unique idea ID */
  id: string;
  /** Case ID */
  caseId: string;
  /** Exhibit title */
  title: string;
  /** Description of the exhibit and why it matters */
  description: string;
  /** Exhibit visual type */
  exhibitType: ExhibitType;
  /** Evidence IDs referenced */
  evidenceIds: string[];
  /** Conflict IDs referenced */
  conflictIds: string[];
  /** Computed priority score */
  priorityScore: number;
  /** Current status */
  status: ExhibitIdeaStatus;
}

// ---------------------------------------------------------------------------
// Suggestion Engine Job Payload — BullMQ job data
// ---------------------------------------------------------------------------

export interface ExhibitSuggestionJobPayload {
  /** Case ID to analyze */
  caseId: string;
  /** What triggered this analysis */
  triggerEvent: ExhibitTriggerEvent;
  /** Optional: specific entity IDs that changed */
  entityIds?: string[];
  /** Timestamp of the trigger */
  triggeredAt: string;
}

// ---------------------------------------------------------------------------
// Suggestion Engine Result — output of a full pipeline run
// ---------------------------------------------------------------------------

export interface SuggestionEngineResult {
  /** Case ID analyzed */
  caseId: string;
  /** Trigger event that initiated this run */
  triggerEvent: ExhibitTriggerEvent;
  /** Patterns detected */
  patternsDetected: number;
  /** Ideas generated */
  ideasGenerated: number;
  /** Ideas stored (after dedup) */
  ideasStored: number;
  /** Processing duration in ms */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Timeline Gap — specific pattern sub-type
// ---------------------------------------------------------------------------

export interface TimelineGap {
  /** Event before the gap */
  beforeEvent: {
    id: string;
    description: string;
    timestamp: Date;
    source: string;
  };
  /** Event after the gap */
  afterEvent: {
    id: string;
    description: string;
    timestamp: Date;
    source: string;
  };
  /** Gap duration in minutes */
  gapMinutes: number;
}

// ---------------------------------------------------------------------------
// Testimony Contradiction — specific pattern sub-type
// ---------------------------------------------------------------------------

export interface TestimonyContradiction {
  /** Statement A */
  statementA: {
    id: string;
    speaker: string;
    content: string;
    source: string;
  };
  /** Statement B (contradicts A) */
  statementB: {
    id: string;
    speaker: string;
    content: string;
    source: string;
  };
  /** Nature of contradiction */
  contradictionType: 'factual' | 'temporal' | 'spatial' | 'quantitative';
}

// ---------------------------------------------------------------------------
// Chain of Custody Issue — specific pattern sub-type
// ---------------------------------------------------------------------------

export interface ChainOfCustodyIssue {
  /** Evidence item ID */
  evidenceId: string;
  /** Description of the issue */
  issueDescription: string;
  /** Type of issue */
  issueType: 'missing_signature' | 'time_gap' | 'handler_mismatch' | 'location_inconsistency';
}

// ---------------------------------------------------------------------------
// Evidence Cluster — group of strongly connected evidence nodes
// ---------------------------------------------------------------------------

export interface EvidenceCluster {
  /** Central evidence node ID */
  centralNodeId: string;
  /** All connected node IDs */
  connectedNodeIds: string[];
  /** Average relationship confidence */
  avgConfidence: number;
  /** Cluster theme/description */
  theme: string;
}

// ---------------------------------------------------------------------------
// Narrative Conflict Group — multiple conflicts about the same event
// ---------------------------------------------------------------------------

export interface NarrativeConflictGroup {
  /** Event or topic these conflicts relate to */
  eventDescription: string;
  /** Conflict IDs in this group */
  conflictIds: string[];
  /** Average severity */
  avgSeverity: number;
}
