// ============================================
// Court Access — Conflict Module Barrel Exports
// Phase 3: Narrative Conflict Detection AI
// ============================================

export { NarrativeConflictDetector } from './narrativeConflictDetector.ts';
export { TimelineConflictAnalyzer } from './timelineConflictAnalyzer.ts';
export { StatementComparator } from './statementComparator.ts';
export { ConflictScoringEngine } from './conflictScoringEngine.ts';
export { ConflictGraphIntegrator } from './conflictGraphIntegrator.ts';

export type {
  ConflictType,
  ConflictSeverity,
  ConflictRelationshipType,
  ConflictScoringFactors,
  ConflictScoringWeights,
  ConflictSeverityScore,
  Statement,
  TimelineEvent,
  DetectedConflict,
  StatementComparisonResult,
  TimelineConflict,
  ConflictDetectionRequest,
  ConflictDetectionResult,
  ConflictGraphInsertionResult,
} from './types.ts';

export { DEFAULT_CONFLICT_SCORING_WEIGHTS } from './types.ts';

export type {
  NarrativeConflictDetectorConfig,
} from './narrativeConflictDetector.ts';

export type {
  TimelineAnalyzerConfig,
} from './timelineConflictAnalyzer.ts';

export type {
  StatementComparatorConfig,
} from './statementComparator.ts';

export type {
  ConflictGraphIntegratorConfig,
} from './conflictGraphIntegrator.ts';
