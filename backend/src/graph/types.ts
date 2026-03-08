// ============================================
// Court Access — Legal Knowledge Graph Types
// Canonical type definitions for the graph layer.
// ============================================

// ---------------------------------------------------------------------------
// Graph Node Types
// ---------------------------------------------------------------------------

export type GraphNodeType =
  | 'Statute'
  | 'Policy'
  | 'CaseLaw'
  | 'Person'
  | 'Officer'
  | 'Agency'
  | 'Evidence'
  | 'Event'
  | 'LegalClaim';

// ---------------------------------------------------------------------------
// Graph Relationship Types
// ---------------------------------------------------------------------------

export type GraphRelationshipType =
  | 'VIOLATES'
  | 'SUPPORTS'
  | 'REFUTES'
  | 'REFERENCES'
  | 'MENTIONS'
  | 'ESTABLISHES'
  | 'CONTRADICTS';

// ---------------------------------------------------------------------------
// Graph Node
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  properties: Record<string, string | number | boolean | null>;
  /** Source document ID from LegalDocument */
  sourceDocumentId: string;
  /** Tenant isolation */
  tenantId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Graph Relationship (Edge)
// ---------------------------------------------------------------------------

export interface GraphRelationship {
  id: string;
  type: GraphRelationshipType;
  sourceNodeId: string;
  targetNodeId: string;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  properties: Record<string, string | number | boolean | null>;
  /** Source document that established this relationship */
  sourceDocumentId: string;
  tenantId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Extracted Entity (pre-graph-insert)
// ---------------------------------------------------------------------------

export interface ExtractedEntity {
  type: GraphNodeType;
  name: string;
  /** Normalized canonical name for dedup */
  canonicalName: string;
  properties: Record<string, string | number | boolean | null>;
  /** Character offset of first occurrence in source document */
  startOffset: number;
  endOffset: number;
  /** All occurrence offsets for proximity-based relationship detection */
  offsets: Array<{ start: number; end: number }>;
}

// ---------------------------------------------------------------------------
// Extracted Relationship (pre-graph-insert)
// ---------------------------------------------------------------------------

export interface ExtractedRelationship {
  type: GraphRelationshipType;
  /** References ExtractedEntity by canonicalName */
  sourceEntityName: string;
  targetEntityName: string;
  /** Entity type of the source (for disambiguating canonicalName collisions) */
  sourceEntityType: GraphNodeType;
  /** Entity type of the target (for disambiguating canonicalName collisions) */
  targetEntityType: GraphNodeType;
  confidence: number;
  properties: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Document Extraction Result
// ---------------------------------------------------------------------------

export interface DocumentExtractionResult {
  documentId: string;
  tenantId: string;
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  /** Processing metadata */
  extractionDurationMs: number;
  entityCount: number;
  relationshipCount: number;
}

// ---------------------------------------------------------------------------
// Graph Indexing Result
// ---------------------------------------------------------------------------

export interface GraphIndexingResult {
  documentId: string;
  nodesCreated: number;
  nodesReused: number;
  relationshipsCreated: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Batch Indexing Summary
// ---------------------------------------------------------------------------

export interface BatchIndexingSummary {
  totalDocuments: number;
  totalNodesCreated: number;
  totalNodesReused: number;
  totalRelationshipsCreated: number;
  totalDurationMs: number;
  failedDocuments: number;
  errors: Array<{ documentId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Graph Query Types
// ---------------------------------------------------------------------------

export interface GraphQueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface PolicyViolationResult {
  policy: GraphNode;
  violator: GraphNode;
  evidence: GraphNode[];
  confidence: number;
}

export interface EvidenceRelationshipResult {
  evidence: GraphNode;
  relatedNodes: Array<{
    node: GraphNode;
    relationship: GraphRelationship;
  }>;
}

export interface StatuteApplicabilityResult {
  statute: GraphNode;
  applicableTo: GraphNode[];
  supportingEvidence: GraphNode[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Neo4j Driver Interface (abstraction for testability)
// ---------------------------------------------------------------------------

export interface Neo4jSession {
  run(query: string, parameters?: Record<string, unknown>): Promise<Neo4jResult>;
  close(): Promise<void>;
}

export interface Neo4jResult {
  records: Neo4jRecord[];
}

export interface Neo4jRecord {
  get(key: string): unknown;
  keys: string[];
  toObject(): Record<string, unknown>;
}

export interface Neo4jDriver {
  session(): Neo4jSession;
  close(): Promise<void>;
  verifyConnectivity(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Graph Configuration
// ---------------------------------------------------------------------------

export interface GraphConfig {
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
  /** Maximum concurrent graph writes */
  writeConcurrency: number;
  /** Batch size for bulk node creation */
  batchSize: number;
}
