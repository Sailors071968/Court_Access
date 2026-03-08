// ============================================
// Court Access — Evidence Relationship Engine
// Public API barrel file
// ============================================

export { EmbeddingService } from './embeddingService.ts';
export { RelationshipScorer } from './relationshipScorer.ts';
export { RelationshipCandidateStore } from './relationshipCandidateStore.ts';
export { EvidenceLinker } from './evidenceLinker.ts';
export { EvidenceIndexer } from './evidenceIndexer.ts';
export type { NodeProvider, EvidenceIndexerConfig } from './evidenceIndexer.ts';

export type {
  // Scoring types
  ScoringWeights,
  ScoringFactors,
  RelationshipScore,

  // Evidence types
  EvidenceRelationship,
  EvidenceLinkingRequest,
  EvidenceLinkingResult,
  EvidenceIndexingSummary,

  // Candidate types
  RelationshipCandidate,
  CandidateStatus,

  // Embedding types
  EmbeddingCacheEntry,
  EmbeddingServiceConfig,

  // Re-exports from graph
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphRelationship,
} from './types.ts';

export {
  CONFIDENCE_THRESHOLD,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_EMBEDDING_CONFIG,
} from './types.ts';
