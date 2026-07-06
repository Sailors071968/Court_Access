// ============================================
// Court Access — Legal Knowledge Graph
// Public API barrel file
// ============================================

export { Neo4jClient } from './neo4jClient.ts';
export { GraphEntityExtractor } from './graphEntityExtractor.ts';
export { GraphRelationshipBuilder } from './graphRelationshipBuilder.ts';
export { GraphIndexer } from './graphIndexer.ts';
export type { DocumentInput } from './graphIndexer.ts';
export { GraphQueryEngine } from './graphQueryEngine.ts';
export { GraphTenantGuard, GuardedNeo4jSession } from './graphTenantGuard.ts';
export type { TenantGuardConfig, TenantGuardViolation } from './graphTenantGuard.ts';
export { GraphIntegrityAudit } from './graphIntegrityAudit.ts';
export type { AuditResult, OrphanNodeCheck, CrossTenantEdgeCheck, MissingTenantIdCheck, NodeStatsCheck } from './graphIntegrityAudit.ts';

export type {
  // Node & relationship types
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphRelationship,

  // Extraction types
  ExtractedEntity,
  ExtractedRelationship,
  DocumentExtractionResult,

  // Indexing types
  GraphIndexingResult,
  BatchIndexingSummary,

  // Query types
  GraphQueryResult,
  PolicyViolationResult,
  EvidenceRelationshipResult,
  StatuteApplicabilityResult,

  // Driver interfaces
  Neo4jDriver,
  Neo4jSession,
  Neo4jResult,
  Neo4jRecord,

  // Configuration
  GraphConfig,
} from './types.ts';
