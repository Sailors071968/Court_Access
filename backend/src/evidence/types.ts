// ============================================
// Court Access — Evidence Relationship Engine Types
// Phase 2: Deterministic confidence scoring for
// evidence-to-entity relationships.
// ============================================

import type {
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphRelationship,
} from '../graph/types.ts';

// ---------------------------------------------------------------------------
// Scoring Factor Weights (must sum to 1.0)
// ---------------------------------------------------------------------------

export interface ScoringWeights {
  semanticSimilarity: number;
  entityCoOccurrence: number;
  documentProximity: number;
  legalReferenceStrength: number;
}

export const DEFAULT_SCORING_WEIGHTS: Readonly<ScoringWeights> = {
  semanticSimilarity: 0.40,
  entityCoOccurrence: 0.25,
  documentProximity: 0.20,
  legalReferenceStrength: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Scoring Factors — individual component scores (0.0–1.0 each)
// ---------------------------------------------------------------------------

export interface ScoringFactors {
  /** Cosine similarity between source and target embeddings */
  semanticSimilarity: number;
  /** Normalized co-occurrence count within the same document(s) */
  entityCoOccurrence: number;
  /** Inverse character distance between entities in source text */
  documentProximity: number;
  /** Strength of legal citation / reference patterns */
  legalReferenceStrength: number;
}

// ---------------------------------------------------------------------------
// Relationship Score — composite result
// ---------------------------------------------------------------------------

export interface RelationshipScore {
  /** Weighted composite score (0.0–1.0) */
  score: number;
  /** Individual factor breakdown */
  factors: ScoringFactors;
  /** Weights used for this computation */
  weights: ScoringWeights;
  /** Whether the score meets the insertion threshold */
  meetsThreshold: boolean;
}

// ---------------------------------------------------------------------------
// Confidence Threshold
// ---------------------------------------------------------------------------

/** Relationships must score >= this value to be inserted into the graph */
export const CONFIDENCE_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Evidence Relationship — extends GraphRelationship with scoring metadata
// ---------------------------------------------------------------------------

export interface EvidenceRelationship {
  /** Source evidence node ID */
  evidenceNodeId: string;
  /** Target node ID (statute, policy, case law, etc.) */
  targetNodeId: string;
  /** Target node type */
  targetNodeType: GraphNodeType;
  /** Relationship type */
  relationshipType: GraphRelationshipType;
  /** Deterministic confidence score */
  score: RelationshipScore;
  /** Tenant isolation */
  tenantId: string;
  /** Source document that produced this evidence */
  sourceDocumentId: string;
  /** Timestamp of scoring computation */
  scoredAt: Date;
}

// ---------------------------------------------------------------------------
// Relationship Candidate — below-threshold relationship for review
// ---------------------------------------------------------------------------

export type CandidateStatus = 'pending' | 'approved' | 'rejected';

export interface RelationshipCandidate {
  id: string;
  /** The scored relationship that did NOT meet threshold */
  relationship: EvidenceRelationship;
  /** Current review status */
  status: CandidateStatus;
  /** Optional reviewer notes */
  reviewNotes: string | null;
  /** When the candidate was stored */
  createdAt: Date;
  /** When the candidate was last reviewed */
  reviewedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Embedding Cache Entry
// ---------------------------------------------------------------------------

export interface EmbeddingCacheEntry {
  /** Content hash (SHA-256 of text) */
  contentHash: string;
  /** The embedding vector */
  embedding: number[];
  /** Dimensionality of the embedding */
  dimensions: number;
  /** Model used to generate the embedding */
  model: string;
  /** Tenant isolation */
  tenantId: string;
  /** When this embedding was generated */
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Evidence Linking Request
// ---------------------------------------------------------------------------

export interface EvidenceLinkingRequest {
  /** Evidence node to link */
  evidenceNode: GraphNode;
  /** Candidate target nodes to evaluate */
  targetNodes: GraphNode[];
  /** Source document text for proximity analysis */
  sourceText: string;
  /** Tenant isolation */
  tenantId: string;
  /** Source document ID */
  sourceDocumentId: string;
}

// ---------------------------------------------------------------------------
// Evidence Linking Result
// ---------------------------------------------------------------------------

export interface EvidenceLinkingResult {
  /** Evidence node that was linked */
  evidenceNodeId: string;
  /** Relationships that met the threshold — inserted into graph */
  insertedRelationships: EvidenceRelationship[];
  /** Relationships below threshold — stored as candidates */
  candidateRelationships: EvidenceRelationship[];
  /** Total relationships evaluated */
  totalEvaluated: number;
  /** Processing duration */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Evidence Indexing Summary
// ---------------------------------------------------------------------------

export interface EvidenceIndexingSummary {
  /** Total evidence nodes processed */
  totalEvidenceNodes: number;
  /** Total relationships evaluated across all evidence */
  totalRelationshipsEvaluated: number;
  /** Total relationships inserted (score >= threshold) */
  totalRelationshipsInserted: number;
  /** Total candidates stored (score < threshold) */
  totalCandidatesStored: number;
  /** Average confidence score of inserted relationships */
  averageInsertedScore: number;
  /** Average confidence score of candidates */
  averageCandidateScore: number;
  /** Total duration */
  totalDurationMs: number;
  /** Errors encountered */
  errors: Array<{ evidenceNodeId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Embedding Service Configuration
// ---------------------------------------------------------------------------

export interface EmbeddingServiceConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Model to use (default: text-embedding-3-small) */
  model: string;
  /** Embedding dimensions (default: 1536) */
  dimensions: number;
  /** Maximum batch size for embedding API calls */
  batchSize: number;
  /** Maximum cache entries (LRU eviction) */
  maxCacheSize: number;
}

export const DEFAULT_EMBEDDING_CONFIG: Readonly<EmbeddingServiceConfig> = {
  apiKey: '',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
  maxCacheSize: 50_000,
} as const;

// ---------------------------------------------------------------------------
// Re-exports from graph module for convenience
// ---------------------------------------------------------------------------

export type {
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphRelationship,
};
