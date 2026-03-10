// ============================================
// Court Access — Exhibit Intelligence Engine
// Barrel Exports
// ============================================

export { ExhibitPatternDetector } from './exhibitPatternDetector.ts';
export { ExhibitIdeaGenerator } from './exhibitIdeaGenerator.ts';
export { ExhibitPriorityScorer } from './exhibitPriorityScorer.ts';
export { ExhibitSuggestionEngine } from './exhibitSuggestionEngine.ts';

export type {
  ExhibitType,
  ExhibitIdeaStatus,
  ExhibitTriggerEvent,
  DetectedPattern,
  PatternScoringFactors,
  PriorityWeights,
  PriorityScoreResult,
  PriorityBand,
  ExhibitIdea,
  ExhibitSuggestionJobPayload,
  SuggestionEngineResult,
  TimelineGap,
  TestimonyContradiction,
  ChainOfCustodyIssue,
  EvidenceCluster,
  NarrativeConflictGroup,
} from './types.ts';

export { DEFAULT_PRIORITY_WEIGHTS } from './types.ts';

export type {
  PatternDetectorConfig,
  PatternDetectionInput,
  TimelineEventInput,
  StatementInput,
  ConflictInput,
  EvidenceNodeInput,
  CustodyRecordInput,
} from './exhibitPatternDetector.ts';

export type {
  PriorityScorerConfig,
} from './exhibitPriorityScorer.ts';

export type {
  SuggestionEngineConfig,
} from './exhibitSuggestionEngine.ts';
