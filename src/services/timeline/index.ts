// ============================================================================
// Timeline Module — Public API
// ============================================================================

export { analyzeEvidenceTimeline } from './evidenceTimelineEngine';
export type {
  TimelineEvent,
  TimelineInconsistency,
  TimelineInvestigativeTask,
  TimelineLegalInstrument,
  EvidenceTimeline,
} from './evidenceTimelineEngine';

export { ActorRegistry, extractActors } from './actorResolutionEngine';
export type {
  Actor,
  ActorType,
  ActorConfidence,
  ExtractedActor,
  ActorValidationEntry,
  ActorValidationReport,
} from './actorResolutionEngine';
