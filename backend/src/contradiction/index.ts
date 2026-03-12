// ============================================================================
// Contradiction Detection Engine — Public API
// Barrel file exporting all CDE modules.
// ============================================================================

// Phase 1 — Types & Event Ontology
export type {
  EventTypeDefinition,
  EventCategory,
  ActorType,
  ObjectType,
  ExtractedEvent,
  ExtractionJobData,
  ExtractionResult,
  ExtractionMethod,
  TimelineEvent,
  TimelineMergeResult,
  AlignmentMethod,
  TimestampSource,
  VideoOverlayMetadata,
  VideoAction,
  VideoProcessingJob,
  VideoProcessingResult,
  VideoProcessingStage,
  Contradiction,
  ContradictionType,
  ContradictionAnalysisResult,
  DoctrineContradictionLink,
  DoctrineMatchResult,
  CdeRecommendationType,
  CdeRecommendation,
  CdeLitigationSummary,
  GraphNodeType,
  GraphEdgeType,
  GraphNode,
  GraphEdge,
  ContradictionGraph,
  ContradictionInvestigationView,
} from './types.ts';

export { TIMESTAMP_PRIORITY, GUARDRAIL_LANGUAGE } from './types.ts';

export {
  EVENT_TYPE_REGISTRY,
  TOTAL_EVENT_TYPES,
  getEventType,
  getEventTypesByCategory,
  getEventTypesByDoctrineRule,
  getOntologyStats,
  isValidEventType,
} from './eventOntology.ts';

// Event Normalization
export {
  normalizeEvent,
  normalizeEvents,
} from './eventNormalization.ts';

// Phase 2 — Event Extraction
export {
  extractEvents,
  extractEventsFromReport,
  extractEventsFromTranscript,
  extractEventsFromCAD,
} from './eventExtractionEngine.ts';

// Phase 3 — Timeline Engine
export {
  buildUnifiedTimeline,
  findTimelineGaps,
  getEventsInWindow,
} from './timelineEngine.ts';

// Phase 4 — Video Intelligence
export {
  processVideo,
  detectBodycamGaps,
} from './videoIntelligencePipeline.ts';

// Phase 5 — Contradiction Detection
export {
  analyzeContradictions,
} from './contradictionDetectionEngine.ts';

// Phase 6 — Doctrine Matching
export {
  matchContradictionToDoctrine,
  matchAllContradictions,
  assessCaseSeverity,
} from './doctrineMatchingEngine.ts';

// Phase 7 — Litigation Intelligence
export {
  generateRecommendations,
  generateLitigationSummary,
} from './litigationIntelligence.ts';

// Phase 8 — Graph Intelligence
export {
  buildContradictionGraph,
  generateCypherStatements,
} from './graphIntelligenceLayer.ts';

// Worker Queue Isolation
export {
  CDE_QUEUE_CONFIGS,
  InMemoryQueue,
  createCdeQueues,
  PM2_ECOSYSTEM_CONFIG,
} from './workerQueues.ts';

// Performance Safeguards
export {
  PERFORMANCE_LIMITS,
  paginateTimeline,
  paginateContradictions,
  batchEvents,
  batchContradictions,
  checkCaseSize,
  RECOMMENDED_INDEXES,
  RECOMMENDED_NEO4J_INDEXES,
} from './performanceSafeguards.ts';

// Routes
export { registerContradictionRoutes } from './contradictionRoutes.ts';
