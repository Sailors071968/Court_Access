// ============================================================================
// Contradiction Detection Engine — Core Type Definitions
// Phases 1-9: Event Ontology, Extraction, Timeline, Video, Contradictions,
// Doctrine Matching, Litigation Intelligence, Graph, Investigation UI
// ============================================================================

// ---------------------------------------------------------------------------
// Phase 1 — Event Ontology Types
// ---------------------------------------------------------------------------

export type EventCategory =
  | 'detention'
  | 'search'
  | 'seizure'
  | 'force'
  | 'movement'
  | 'communication'
  | 'evidence_handling'
  | 'vehicle_operation'
  | 'scene_control'
  | 'arrest'
  | 'miranda'
  | 'identification'
  | 'medical'
  | 'weapon'
  | 'documentation'
  | 'surveillance'
  | 'k9'
  | 'dispatch';

export type ActorType =
  | 'officer'
  | 'suspect'
  | 'witness'
  | 'victim'
  | 'bystander'
  | 'dispatcher'
  | 'supervisor'
  | 'ems'
  | 'detective'
  | 'k9_handler'
  | 'unknown';

export type ObjectType =
  | 'person'
  | 'vehicle'
  | 'weapon'
  | 'contraband'
  | 'document'
  | 'electronic_device'
  | 'clothing'
  | 'container'
  | 'building'
  | 'area'
  | 'bodycam'
  | 'dashcam'
  | 'radio'
  | 'handcuffs'
  | 'evidence_bag'
  | 'firearm'
  | 'taser'
  | 'baton'
  | 'k9'
  | 'narcotics'
  | 'currency'
  | 'identification_card'
  | 'phone'
  | 'surveillance_camera'
  | 'none';

export interface EventTypeDefinition {
  eventTypeId: string;
  category: EventCategory;
  eventName: string;
  description: string;
  actorTypes: ActorType[];
  objectTypes: ObjectType[];
  relatedDoctrineRules: string[];
  /** Weight for contradiction scoring (0.0–1.0). Higher = more legally significant. */
  eventWeight: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 2 — Event Extraction Types
// ---------------------------------------------------------------------------

export type ExtractionMethod =
  | 'REPORT_NLP'
  | 'TRANSCRIPT_NLP'
  | 'VIDEO_ACTION_DETECTION'
  | 'AUDIO_TRANSCRIPT_ANALYSIS'
  | 'CAD_IMPORT'
  | 'MANUAL_ENTRY';

export interface ExtractedEvent {
  eventId: string;
  caseId: string;
  eventType: string;
  timestamp: string | null;
  timestampSource: TimestampSource | null;
  actor: string;
  actorRole: ActorType;
  object: string | null;
  location: string | null;
  sourceEvidenceId: string;
  /** Exact text span from the source evidence that generated this event. */
  sourceTextSpan: string | null;
  /** Timestamp as recorded in the original source (before normalization). */
  sourceTimestamp: string | null;
  /** Confidence score from the source evidence (0.0–1.0). */
  sourceConfidence: number;
  confidence: number;
  extractionMethod: ExtractionMethod;
  rawText: string | null;
  /** Whether this event has been validated through normalizeEvent(). */
  normalized: boolean;
  createdAt: string;
}

export interface ExtractionJobData {
  caseId: string;
  evidenceId: string;
  evidenceType: 'report' | 'transcript' | 'video' | 'cad_log' | 'witness_statement';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  evidenceId: string;
  eventsExtracted: number;
  events: ExtractedEvent[];
  processingTimeMs: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Phase 3 — Unified Timeline Types
// ---------------------------------------------------------------------------

export type TimestampSource =
  | 'bodycam_overlay'
  | 'cad_dispatch'
  | 'video_transcript'
  | 'officer_report'
  | 'witness_estimate'
  | 'dashcam_overlay'
  | 'surveillance_timestamp'
  | 'radio_log'
  | 'manual';

export const TIMESTAMP_PRIORITY: TimestampSource[] = [
  'bodycam_overlay',
  'dashcam_overlay',
  'cad_dispatch',
  'surveillance_timestamp',
  'radio_log',
  'video_transcript',
  'officer_report',
  'witness_estimate',
  'manual',
];

export type AlignmentMethod =
  | 'direct'
  | 'clock_drift_corrected'
  | 'cross_reference'
  | 'interpolated'
  | 'estimated';

export interface TimelineEvent {
  timelineEventId: string;
  caseId: string;
  eventId: string;
  canonicalTimestamp: string;
  originalTimestamp: string;
  timestampSource: TimestampSource;
  alignmentMethod: AlignmentMethod;
  confidence: number;
  driftCorrectionMs: number;
  actor: string;              // Who performed/reported this event (officer name, witness name, etc.)
  actorRole: ActorType;       // Role classification from ActorType enum
}

export interface TimelineMergeResult {
  caseId: string;
  totalEvents: number;
  mergedEvents: number;
  clockDriftDetected: boolean;
  driftCorrections: Array<{
    sourceA: TimestampSource;
    sourceB: TimestampSource;
    driftMs: number;
  }>;
  timeline: TimelineEvent[];
}

// ---------------------------------------------------------------------------
// Phase 4 — Video Intelligence Types
// ---------------------------------------------------------------------------

export type VideoProcessingStage =
  | 'ingestion'
  | 'frame_extraction'
  | 'overlay_ocr'
  | 'speech_transcription'
  | 'action_detection'
  | 'event_generation';

export interface VideoOverlayMetadata {
  videoId: string;
  frameTimestamp: string;
  overlayTimestamp: string | null;
  gpsLat: number | null;
  gpsLong: number | null;
  vehicleSpeed: number | null;
  cameraId: string | null;
  officerId: string | null;
  confidence: number;
}

export interface VideoAction {
  videoId: string;
  timestamp: string;
  actionType: string;
  actorLabel: string;
  objectDetected: string | null;
  confidence: number;
}

export interface VideoProcessingJob {
  videoId: string;
  caseId: string;
  videoUrl: string;
  videoType: 'bodycam' | 'dashcam' | 'surveillance' | 'other';
  frameIntervalSec: number;
  stages: VideoProcessingStage[];
}

export interface VideoProcessingResult {
  videoId: string;
  framesExtracted: number;
  overlaysDetected: number;
  actionsDetected: number;
  eventsGenerated: number;
  processingTimeMs: number;
  stages: Array<{
    stage: VideoProcessingStage;
    status: 'completed' | 'failed' | 'skipped';
    durationMs: number;
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Phase 5 — Contradiction Detection Types
// ---------------------------------------------------------------------------

export type ContradictionType =
  | 'narrative_inconsistency'
  | 'timeline_conflict'
  | 'missing_bodycam_activation'
  | 'dispatch_report_inconsistency'
  | 'witness_conflict'
  | 'evidence_appearance_disappearance'
  | 'location_inconsistency'
  | 'action_sequence_conflict'
  | 'force_justification_gap'
  | 'missing_miranda'
  | 'consent_dispute'
  | 'search_authority_gap'
  | 'chain_of_custody_gap'
  | 'identity_inconsistency'
  | 'count_discrepancy';

export interface Contradiction {
  contradictionId: string;
  caseId: string;
  eventA: string;
  eventB: string;
  contradictionType: ContradictionType;
  description: string;
  timeRangeStart: string | null;
  timeRangeEnd: string | null;
  confidence: number;
  /** Composite contradiction score for ranking/filtering. */
  contradictionScore: number;
  sourceEvidenceIds: string[];
  createdAt: string;
}

export interface ContradictionAnalysisResult {
  caseId: string;
  totalContradictions: number;
  byType: Partial<Record<ContradictionType, number>>;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  contradictions: Contradiction[];
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 6 — Doctrine Matching Types
// ---------------------------------------------------------------------------

export interface DoctrineContradictionLink {
  contradictionId: string;
  doctrineRuleId: string;
  eventTypeId: string;
  matchDescription: string;
  severity: 'critical' | 'significant' | 'moderate' | 'minor';
  confidence: number;
}

export interface DoctrineMatchResult {
  contradictionId: string;
  doctrineMatches: DoctrineContradictionLink[];
  proceduralDeviations: string[];
}

// ---------------------------------------------------------------------------
// Phase 7 — Litigation Intelligence Types
// ---------------------------------------------------------------------------

export type CdeRecommendationType =
  | 'motion_to_suppress'
  | 'motion_to_dismiss'
  | 'evidence_exclusion'
  | 'investigative_task'
  | 'expert_consultation'
  | 'motion_for_discovery'
  | 'motion_for_sanctions'
  | 'brady_request';

export interface CdeRecommendation {
  recommendationId: string;
  caseId: string;
  type: CdeRecommendationType;
  title: string;
  description: string;
  sourceEventId: string;
  sourceEvidenceId: string;
  doctrineRuleId: string | null;
  contradictionId: string | null;
  confidence: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface CdeLitigationSummary {
  caseId: string;
  recommendations: CdeRecommendation[];
  motionCount: number;
  investigativeTaskCount: number;
  expertConsultationCount: number;
  overallStrength: 'strong' | 'moderate' | 'developing' | 'weak';
}

// ---------------------------------------------------------------------------
// Phase 8 — Graph Intelligence Types
// ---------------------------------------------------------------------------

export type GraphNodeType =
  | 'Officer'
  | 'Suspect'
  | 'Witness'
  | 'Evidence'
  | 'Event'
  | 'Location'
  | 'Vehicle'
  | 'Weapon'
  | 'Contradiction';

export type GraphEdgeType =
  | 'PERFORMED'
  | 'OBSERVED'
  | 'RECORDED_BY'
  | 'DERIVED_FROM'
  | 'MENTIONED_IN'
  | 'CONTRADICTS'
  | 'LOCATED_AT'
  | 'INVOLVED_IN'
  | 'PRECEDED_BY'
  | 'FOLLOWED_BY'
  | 'COLLECTED'
  | 'TRANSPORTED'
  | 'RELATED_TO';

export interface GraphNode {
  nodeId: string;
  type: GraphNodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: GraphEdgeType;
  properties: Record<string, unknown>;
}

export interface ContradictionGraph {
  caseId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  contradictionClusters: Array<{
    clusterId: string;
    contradictionIds: string[];
    relatedEventIds: string[];
    description: string;
  }>;
}

// ---------------------------------------------------------------------------
// Phase 9 — Investigation UI Types
// ---------------------------------------------------------------------------

export interface ContradictionInvestigationView {
  caseId: string;
  contradictions: Contradiction[];
  timeline: TimelineEvent[];
  graph: ContradictionGraph;
  recommendations: CdeRecommendation[];
  doctrineMatches: DoctrineMatchResult[];
  summary: {
    totalContradictions: number;
    highConfidence: number;
    narrativeInconsistencies: number;
    timelineConflicts: number;
    missingActivations: number;
    proceduralDeviations: number;
  };
}

// ---------------------------------------------------------------------------
// Guardrails — Language Constants
// ---------------------------------------------------------------------------

/**
 * The system must NEVER use accusatory language.
 * All outputs use neutral, investigative framing.
 */
export const GUARDRAIL_LANGUAGE = {
  allowed: [
    'Potential inconsistency',
    'Potential deviation',
    'Requires human review',
    'Potential discrepancy',
    'Warrants further examination',
    'Possible procedural gap',
    'Notation for review',
  ],
  forbidden: [
    'violation',
    'misconduct',
    'illegal act',
    'crime',
    'wrongdoing',
    'corrupt',
    'lied',
    'perjury',
  ],
} as const;
